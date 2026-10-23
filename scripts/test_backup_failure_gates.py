"""Exercise real production scripts against synthetic backups, never live services."""
import json
import os
import pathlib
import re
import socket
import subprocess
import sys
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).parent
SHA = 'a' * 40
RESULTS = []

# Only this adapter is synthetic. Creation, integrity verification and shell
# orchestration use the actual release's code. No root-only CLI mode is invoked.
BACKUP_DRIVER = '''#!/usr/bin/python3
import importlib.util, os, pathlib, sys
root = pathlib.Path(os.environ['FIXTURE'])
spec = importlib.util.spec_from_file_location('backup', sys.argv[1])
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
mode, sha = sys.argv[2:4]
with pathlib.Path(os.environ['TRACE']).open('a') as log:
    log.write('backup-' + mode + '\\n')
class SyntheticPostgres:
    def dump(self, path):
        if os.environ['FAILURE'] == 'backup':
            raise OSError('Fallo simulado al escribir el respaldo sintetico')
        path.write_bytes(b'synthetic PostgreSQL dump')
    def restore_check(self, path):
        return {'users': 2, 'invoices': 1, 'payments': 0, 'files': 0, 'migrations': 1}
try:
    os.umask(0o077)
    if mode == 'create':
        volume = root / 'minio'
        volume.mkdir()
        (volume / 'synthetic.pdf').write_bytes(b'synthetic receipt')
        receipt = backup.create_backup(sha, root / 'backups', volume,
            backend=SyntheticPostgres(), configuration=lambda target: None)
        (receipt.parent / backup.POSTGRES_DUMP).write_bytes(b'CORRUPTED SYNTHETIC COPY')
        print(receipt)
    else:
        backup.verify_backup(sha, pathlib.Path(sys.argv[4]), root / 'backups')
except Exception as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)
'''


@unittest.skipIf(os.name == 'nt', 'Production shell probes require Linux')
class BackupFailureGates(unittest.TestCase):
    def probe(self, failure, *, bypass=False):
        with tempfile.TemporaryDirectory(prefix='synthetic-backup-gate-') as temporary:
            root = pathlib.Path(temporary)
            scripts = root / 'scripts'
            scripts.mkdir()
            release = (SOURCE / 'production-release.sh').read_text()
            deployment = (SOURCE / 'deploy-vps.sh').read_text().replace(
                '/opt/asesoria-inmobiliaria/deploy.lock', str(root / 'deploy.lock'))
            if bypass:
                if failure == 'backup':
                    original = 'receipt="$(python3 "$repo/scripts/backup-production.py" create "$release")"'
                    self.assertIn(original, release)
                    release = release.replace(original, original + ' || true')
                else:
                    original = 'python3 "$repo/scripts/backup-production.py" verify "$release" "${INMO_PRODUCTION_BACKUP_RECEIPT:-}"'
                    self.assertIn(original, deployment)
                    deployment = deployment.replace(original, original + ' || true')
            (scripts / 'production-release.sh').write_text(release)
            (scripts / 'deploy-vps.sh').write_text(deployment)
            (scripts / 'backup-production.py').write_bytes((SOURCE / 'backup-production.py').read_bytes())
            (scripts / 'e2e-production-vps.sh').write_text('echo forbidden-e2e >> "$TRACE"\nexit 99\n')
            tools = root / 'bin'
            tools.mkdir()
            commands = {
                'python3': BACKUP_DRIVER,
                'git': '#!/bin/sh\nif [ "$3" = rev-parse ]; then echo "$SHA"; fi\n',
                # The real Sonar gate remains in validate, independently of this
                # isolated simulation which has no network or Sonar credentials.
                'node': '#!/bin/sh\necho sonar >> "$TRACE"\n',
            }
            # mktemp is the first preparation command after receipt verification.
            # Intercept it too, so a masked verification cannot pass accidentally
            # merely because production configuration is absent on the CI host.
            for name in ('mktemp', 'kubectl', 'docker', 'ctr', 'curl'):
                commands[name] = '#!/bin/sh\necho forbidden-' + name + ' >> "$TRACE"\nexit 99\n'
            for name, body in commands.items():
                executable = tools / name
                executable.write_text(body)
                executable.chmod(0o755)
            trace = root / 'trace'
            result = subprocess.run(['/bin/bash', str(scripts / 'production-release.sh'), SHA],
                                    env={'PATH': str(tools) + ':/usr/bin:/bin', 'SHA': SHA,
                                         'FIXTURE': str(root), 'FAILURE': failure, 'TRACE': str(trace)},
                                    capture_output=True, text=True, timeout=20, check=False)
            expected = ['backup-create'] if failure == 'backup' else ['backup-create', 'sonar', 'backup-verify']
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertEqual(trace.read_text().splitlines(), expected, result.stderr)
            if failure == 'backup':
                self.assertFalse(list((root / 'backups').glob('*/verified.json')))
                self.assertTrue(list((root / 'backups').glob('*/failed.json')))
            else:
                self.assertIn('corrupto', result.stderr)
            RESULTS.append({'failure': failure, 'exitCode': result.returncode,
                            'deploymentBlocked': True, 'trace': expected,
                            'deploymentCommandsCalled': False, 'postDeployE2EReached': False})

    def test_backup_creation_failure_blocks_production(self):
        self.probe('backup')

    def test_real_integrity_verification_blocks_corrupt_backup(self):
        self.probe('verification')

    def test_probe_detects_a_masked_backup_failure(self):
        with self.assertRaises(AssertionError):
            self.probe('backup', bypass=True)

    def test_probe_detects_a_masked_verification_failure(self):
        with self.assertRaises(AssertionError):
            self.probe('verification', bypass=True)


def main():
    global SHA
    if len(sys.argv) != 2 or not re.fullmatch('[a-f0-9]{40}', sys.argv[1]):
        raise RuntimeError('Se exige el SHA completo analizado por CI.')
    SHA = sys.argv[1]
    if os.environ.get('CI') != 'true' or os.geteuid() == 0:
        raise RuntimeError('Las simulaciones requieren CI sin privilegios.')
    status = pathlib.Path('/proc/self/status').read_text()
    if not re.search(r'^NoNewPrivs:\s+1$', status, re.MULTILINE) or not re.search(r'^CapEff:\s+0+$', status, re.MULTILINE):
        raise RuntimeError('Se exige impedir escalacion de privilegios y eliminar capacidades.')
    if any(name != 'lo' for _, name in socket.if_nameindex()):
        raise RuntimeError('Las simulaciones requieren un namespace sin red externa.')
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(BackupFailureGates))
    passed = (result.wasSuccessful() and result.testsRun == 4 and len(RESULTS) == 2
              and {item['failure'] for item in RESULTS} == {'backup', 'verification'})
    report = {'sha': SHA, 'passed': passed, 'testsRun': result.testsRun,
              'unprivileged': True, 'networkIsolated': True, 'syntheticDataOnly': True,
              'results': RESULTS, 'bypassMutationControlsPassed': passed}
    target = pathlib.Path('coverage/backup-failure-gates.json')
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())
