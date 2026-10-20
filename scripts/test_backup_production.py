"""Restore, corruption and failure gates for production backups; no production access."""
import contextlib
import datetime
import importlib.util
import io
import json
import os
import pathlib
import runpy
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import Mock, patch

SOURCE = pathlib.Path(__file__).with_name('backup-production.py')
spec = importlib.util.spec_from_file_location('backup_production', SOURCE)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
SHA = 'a' * 40
COUNTS = {'users': 2, 'invoices': 3, 'payments': 1, 'files': 1, 'migrations': 11}


class FakePostgres:
    def __init__(self, *args, **kwargs):
        pass

    def dump(self, target):
        target.write_bytes(b'private pg dump fixture')

    def restore_check(self, dump):
        if dump.read_bytes() != b'private pg dump fixture':
            raise RuntimeError('bad dump')
        return dict(COUNTS)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.previous_umask = os.umask(0o077)
        self.temporary = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temporary.name)
        self.volume = self.root / 'minio'
        self.volume.mkdir()
        (self.volume / 'receipt.pdf').write_bytes(b'%PDF synthetic fixture')
        (self.volume / '.minio.sys').mkdir()
        (self.volume / '.minio.sys' / 'metadata').write_bytes(b'minio metadata')
        self.backups = self.root / 'backups'

    def tearDown(self):
        self.temporary.cleanup()
        os.umask(self.previous_umask)

    def create(self, **kwargs):
        return b.create_backup(SHA, self.backups, self.volume, backend=kwargs.pop('backend', FakePostgres()),
                               configuration=kwargs.pop('configuration', lambda directory: (directory / 'config.yaml').write_text('synthetic config')), **kwargs)

    def test_restores_both_archives_and_keeps_originals_unchanged(self):
        before = b.inventory(self.volume)
        receipt = self.create()
        report = b.verify_backup(SHA, receipt, self.backups)
        self.assertEqual(report['postgres_restored_counts'], COUNTS)
        self.assertEqual(report['minio_files_verified'], 2)
        self.assertTrue(report['minio_restore_verified'])
        self.assertEqual(b.inventory(self.volume), before)
        self.assertEqual(list(receipt.parent.glob('restore-*')), [])
        self.assertEqual(receipt.stat().st_mode & 0o077, 0)
        # Every invocation needs a fresh backup, even when SHA and contents are unchanged.
        self.assertNotEqual(receipt, self.create())

    def test_corruption_wrong_sha_stale_unverified_and_failed_receipts_block(self):
        receipt = self.create()
        original = receipt.read_text()
        for changes in [{'sha': 'b'*40}, {'version': 2}, {'postgres_restore_verified': False},
                        {'minio_restore_verified': False}, {'minio_files_verified': 0},
                        {'created_at': (datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(hours=2)).isoformat()},
                        {'created_at': (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=1)).isoformat()}]:
            with self.subTest(changes=changes):
                report = json.loads(original)
                report.update(changes)
                receipt.write_text(json.dumps(report))
                with self.assertRaises(RuntimeError):
                    b.verify_backup(SHA, receipt, self.backups)
        receipt.write_text(original)
        (receipt.parent / 'failed.json').write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'fallido'):
            b.verify_backup(SHA, receipt, self.backups)
        (receipt.parent / 'failed.json').unlink()
        (receipt.parent / 'postgres.dump').write_bytes(b'corrupt')
        with self.assertRaisesRegex(RuntimeError, 'corrupto'):
            b.verify_backup(SHA, receipt, self.backups)

    def test_missing_data_and_invalid_checksum_paths_block(self):
        receipt = self.create()
        index = receipt.parent / 'checksums.json'
        correct = json.loads(index.read_text())
        for checksums in [{}, {**correct, '../outside': 'z'}]:
            index.write_text(json.dumps(checksums))
            report = json.loads(receipt.read_text())
            report['checksums_sha256'] = b.digest(index)
            receipt.write_text(json.dumps(report))
            with self.assertRaises(RuntimeError):
                b.verify_backup(SHA, receipt, self.backups)
        index.write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'índice'):
            b.verify_backup(SHA, receipt, self.backups)

    def test_private_path_and_permissions_are_required(self):
        receipt = self.create()
        for invalid in [pathlib.Path('relative/verified.json'), receipt.parent / 'not-verified.json', self.root / 'verified.json']:
            with self.assertRaises(RuntimeError):
                b.verify_backup(SHA, invalid, self.backups)
        if os.name != 'nt':
            receipt.chmod(0o644)
            with self.assertRaisesRegex(RuntimeError, 'privado'):
                b.verify_backup(SHA, receipt, self.backups)

    def test_restore_or_configuration_failure_never_creates_verified_receipt(self):
        for method in ['dump', 'restore_check']:
            pg = FakePostgres()
            setattr(pg, method, Mock(side_effect=RuntimeError('expected failure')))
            with self.assertRaises(RuntimeError):
                self.create(backend=pg)
        with self.assertRaises(RuntimeError):
            self.create(configuration=Mock(side_effect=RuntimeError('configuration failed')))
        for directory in self.backups.iterdir():
            self.assertFalse((directory / 'verified.json').exists())
            self.assertTrue((directory / 'failed.json').exists())

    def test_changed_minio_and_low_space_block(self):
        pg = FakePostgres()
        original = pg.restore_check
        def change(dump):
            (self.volume / 'receipt.pdf').write_bytes(b'changed during backup')
            return original(dump)
        pg.restore_check = change
        with self.assertRaises(RuntimeError):
            self.create(backend=pg)
        with patch.object(b.shutil, 'disk_usage', return_value=Mock(free=1)):
            with self.assertRaisesRegex(RuntimeError, 'Espacio insuficiente'):
                self.create()
        restore = b.restore_archive
        def change_after_restore(*args):
            restore(*args)
            (self.volume / 'receipt.pdf').write_bytes(b'changed after extraction')
        with patch.object(b, 'restore_archive', side_effect=change_after_restore), self.assertRaisesRegex(RuntimeError, 'cambió'):
            self.create()

    def test_empty_volume_and_invalid_sha_block(self):
        empty = self.root / 'empty'
        empty.mkdir()
        with self.assertRaisesRegex(RuntimeError, 'vacío'):
            b.inventory(empty)
        with self.assertRaisesRegex(RuntimeError, 'SHA'):
            b.create_backup('main', self.backups, self.volume)
        with self.assertRaisesRegex(RuntimeError, 'SHA'):
            b.verify_backup('main', self.root, self.backups)

    @unittest.skipIf(os.name == 'nt', 'POSIX links and special files')
    def test_links_and_special_files_are_not_archived(self):
        link = self.volume / 'link'
        link.symlink_to(self.volume / 'receipt.pdf')
        with self.assertRaises(RuntimeError):
            b.inventory(self.volume)
        link.unlink()
        os.mkfifo(link)
        with self.assertRaises(RuntimeError):
            b.inventory(self.volume)

    def test_archive_traversal_links_duplicates_and_corrupt_content_block(self):
        for name, kind in [('../escape', 'file'), ('/escape', 'file'), ('link', 'link'), ('receipt.pdf', 'duplicate')]:
            with self.subTest(name=name, kind=kind), tempfile.TemporaryDirectory(dir=self.root) as temporary:
                archive = self.root / 'unsafe.tar.gz'
                with tarfile.open(archive, 'w:gz') as stream:
                    member = tarfile.TarInfo(name)
                    if kind == 'link':
                        member.type = tarfile.SYMTYPE
                        member.linkname = '/etc/passwd'
                        stream.addfile(member)
                    else:
                        member.size = 1
                        stream.addfile(member, io.BytesIO(b'x'))
                        if kind == 'duplicate':
                            stream.addfile(member, io.BytesIO(b'x'))
                with self.assertRaises(RuntimeError):
                    b.restore_archive(archive, pathlib.Path(temporary), {'receipt.pdf': 'not the hash'})

    def test_pg_restore_uses_generated_target_and_always_drops_only_that_database(self):
        pg = b.Postgres(self.root / 'diagnostic')
        dump = self.root / 'dump'
        dump.write_bytes(b'dump')
        commands = []
        def execute(command, **kwargs):
            commands.append(command)
            return json.dumps(COUNTS).encode() if command.startswith('psql') else b''
        with patch.object(pg, 'execute', side_effect=execute):
            self.assertEqual(pg.restore_check(dump), COUNTS)
        database = commands[0].split()[-1]
        self.assertRegex(database, '^inmo_restore_check_[a-f0-9]{32}$')
        self.assertTrue(all(database in command for command in commands))
        self.assertTrue(commands[-1].startswith('dropdb'))
        commands.clear()
        def fail_restore(command, **kwargs):
            commands.append(command)
            if command.startswith('pg_restore'):
                raise RuntimeError('corrupt dump')
            return b''
        with patch.object(pg, 'execute', side_effect=fail_restore), self.assertRaises(RuntimeError):
            pg.restore_check(dump)
        self.assertTrue(commands[-1].startswith('dropdb'))
        with patch.object(pg, 'execute', return_value=json.dumps({**COUNTS, 'migrations': 0}).encode()), self.assertRaises(RuntimeError):
            pg.restore_check(dump)

    def test_postgres_executes_with_private_errors_and_rejects_non_ci_connections(self):
        pg = b.Postgres(self.root / 'diagnostic')
        with patch.object(b.subprocess, 'run', return_value=Mock(returncode=0, stdout=b'ok')) as run:
            self.assertEqual(pg.execute('SELECT fixture'), b'ok')
            self.assertEqual(run.call_args.args[0][:3], ['kubectl', '-n', b.NAMESPACE])
            pg.dump(self.root / 'dump')
        with patch.object(b.subprocess, 'run', return_value=Mock(returncode=1, stdout=b'')), self.assertRaises(RuntimeError):
            pg.execute('failure')
        with patch.dict(os.environ, {'CI': 'true'}):
            local = b.Postgres(self.root / 'diagnostic', 'postgresql://ci:private@127.0.0.1:5432/inmobiliaria_ci')
            self.assertEqual(local.prefix, ['sh', '-ec'])
            self.assertEqual(local.env['PGPASSWORD'], 'private')
            for url in ['postgresql://ci:x@remote/inmobiliaria_ci', 'postgresql://ci:x@127.0.0.1/production']:
                with self.assertRaises(RuntimeError):
                    b.Postgres(self.root / 'diagnostic', url)
            with patch.dict(os.environ, {'BACKUP_CI_POSTGRES_CONTAINER': 'c'*64}):
                container = b.Postgres(self.root/'diagnostic', 'postgresql://ci:x@127.0.0.1/inmobiliaria_ci')
                self.assertEqual(container.prefix[:3], ['docker','exec','-i'])
                with patch.object(b.subprocess, 'run', return_value=Mock(returncode=0, stdout=b'ok')) as run:
                    container.execute('fixture')
                    self.assertIn('test "$POSTGRES_DB" = inmobiliaria_ci', run.call_args.args[0][-1])
            with patch.dict(os.environ, {'BACKUP_CI_POSTGRES_CONTAINER': 'not-a-container'}), self.assertRaises(RuntimeError):
                b.Postgres(self.root/'diagnostic', 'postgresql://ci:x@127.0.0.1/inmobiliaria_ci')
        with patch.dict(os.environ, {'CI': 'false'}), self.assertRaises(RuntimeError):
            b.Postgres(self.root / 'diagnostic', 'postgresql://ci:x@127.0.0.1/inmobiliaria_ci')

    def test_configuration_is_private_and_missing_inputs_block(self):
        config = self.root / 'config'
        config.write_bytes(b'private configuration')
        target = self.root / 'configuration-backup'
        target.mkdir()
        with patch.object(b, 'PROTECTED', {'fixture': config}), patch.object(b.subprocess, 'run', return_value=Mock(returncode=0)):
            b.save_configuration(target)
        self.assertEqual((target / 'fixture').read_bytes(), config.read_bytes())
        with patch.object(b.subprocess, 'run', return_value=Mock(returncode=1)), self.assertRaises(RuntimeError):
            b.save_configuration(target)
        with patch.object(b, 'PROTECTED', {'fixture': self.root/'missing'}), patch.object(b.subprocess, 'run', return_value=Mock(returncode=0)), self.assertRaises(RuntimeError):
            b.save_configuration(target)

    def test_cli_ci_restore_and_verify_modes(self):
        with patch.object(sys, 'argv', ['backup', 'ci', SHA]), patch.object(b, 'Postgres', FakePostgres), patch.dict(os.environ, {'DATABASE_URL': 'synthetic'}), contextlib.redirect_stdout(io.StringIO()):
            b.main()
        receipt = self.create()
        with patch.object(sys, 'argv', ['backup', 'verify', SHA, str(receipt)]), patch.object(b.os, 'geteuid', return_value=0, create=True), patch.object(b, 'BACKUPS', self.backups), contextlib.redirect_stdout(io.StringIO()):
            b.main()
        with patch.object(sys, 'argv', ['backup', 'create', SHA]), patch.object(b.os, 'geteuid', return_value=123, create=True), self.assertRaises(RuntimeError):
            b.main()

    @unittest.skipIf(os.name == 'nt', 'VPS flock is POSIX only')
    def test_cli_create_and_entrypoint_fail_closed(self):
        receipt = self.create()
        with patch.object(sys, 'argv', ['backup', 'create', SHA]), patch.object(b.os, 'geteuid', return_value=0), patch.object(b, 'create_backup', return_value=receipt), patch.object(b, 'LOCK', self.root/'lock'), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            b.main()
        with patch.object(sys, 'argv', ['backup', 'verify', 'invalid']), patch.object(os, 'geteuid', return_value=0), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            runpy.run_path(str(SOURCE), run_name='__main__')
        self.assertEqual(error.exception.code, 1)


@unittest.skipIf(os.name == 'nt', 'Linux production shell runner')
class ReleaseGateTests(unittest.TestCase):
    def test_deploy_rechecks_receipt_after_sonar_before_any_mutation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            scripts = root/'scripts'
            scripts.mkdir()
            (scripts/'deploy-vps.sh').write_bytes(SOURCE.with_name('deploy-vps.sh').read_bytes())
            tools = root/'bin'
            tools.mkdir()
            commands = {
                'git': 'if [ "$3" = rev-parse ]; then echo "$SHA"; fi\n',
                'node': 'echo sonar >> "$TRACE"\n',
                'python3': 'echo backup-verify >> "$TRACE"\nexit 1\n',
                'flock': 'exit 0\n',
                'kubectl': 'echo forbidden-kubectl >> "$TRACE"\nexit 1\n',
                'docker': 'echo forbidden-docker >> "$TRACE"\nexit 1\n',
            }
            for name, body in commands.items():
                script = tools/name
                script.write_text('#!/bin/sh\n'+body)
                script.chmod(0o755)
            trace = root/'trace'
            result = subprocess.run(['/bin/bash',str(scripts/'deploy-vps.sh'),'prod',SHA], env={**os.environ,'SHA':SHA,'TRACE':str(trace),'PATH':str(tools)+os.pathsep+os.environ['PATH']},capture_output=True,timeout=10)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual(trace.read_text().splitlines(), ['sonar','backup-verify'])

    def test_backup_and_verification_failures_prevent_deploy_and_keep_e2e_mandatory(self):
        for failure in ['', 'backup', 'verification', 'deploy', 'e2e']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temporary:
                root = pathlib.Path(temporary)
                scripts = root/'scripts'
                scripts.mkdir()
                (scripts/'production-release.sh').write_bytes(SOURCE.with_name('production-release.sh').read_bytes())
                (scripts/'backup-production.py').write_text("import os,pathlib,sys\np=pathlib.Path(os.environ['TRACE'])\nwith p.open('a') as f:f.write('backup\\n')\nif os.environ['FAILURE'] in ['backup','verification']:sys.exit(1)\nprint('/private/fresh/verified.json')\n")
                (scripts/'deploy-vps.sh').write_text('set -eu\n[ "$INMO_PRODUCTION_BACKUP_RECEIPT" = /private/fresh/verified.json ]\necho deploy >> "$TRACE"\n[ "$FAILURE" != deploy ]\n')
                (scripts/'e2e-production-vps.sh').write_text('set -eu\necho e2e >> "$TRACE"\n[ "$FAILURE" != e2e ]\n')
                trace = root/'trace'
                result = subprocess.run(['/bin/bash', str(scripts/'production-release.sh'), SHA], env={**os.environ, 'TRACE':str(trace), 'FAILURE':failure}, capture_output=True, timeout=10)
                self.assertEqual(result.returncode == 0, failure == '')
                expected = ['backup'] if failure in ('backup','verification') else ['backup','deploy'] if failure == 'deploy' else ['backup','deploy','e2e']
                self.assertEqual(trace.read_text().splitlines(), expected)
