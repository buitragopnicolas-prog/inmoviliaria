"""Create and restore-check private backups. Never restore over the live database."""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import uuid
from urllib.parse import unquote, urlsplit

NAMESPACE = 'asesoria-inmobiliaria'
BACKUPS = pathlib.Path('/root/backups/production')
MINIO = pathlib.Path('/var/lib/asesoria-inmobiliaria/minio')
LOCK = pathlib.Path('/opt/asesoria-inmobiliaria/deploy.lock')
POSTGRES_DUMP = 'postgres.dump'
MINIO_ARCHIVE = 'minio.tar.gz'
CHECKSUM_INDEX = 'checksums.json'
VERIFIED_RECEIPT = 'verified.json'
RESOURCES = ('deployments', 'statefulsets', 'configmaps', 'secrets', 'services', 'ingresses', 'networkpolicies')
PROTECTED = {
    'manual-payments.json': pathlib.Path('/etc/asesoria-inmobiliaria/manual-payments.json'),
    'payment-qr.jpeg': pathlib.Path('/opt/asesoria-inmobiliaria/payments/bancolombia-breb.jpeg'),
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inventory(directory):
    require(directory.is_dir() and not directory.is_symlink(), 'No existe el volumen esperado.')
    result = {}
    for path in sorted(directory.rglob('*')):
        require(not path.is_symlink(), 'El volumen contiene un enlace no permitido.')
        if path.is_file():
            result[path.relative_to(directory).as_posix()] = digest(path)
        else:
            require(path.is_dir(), 'El volumen contiene un archivo especial no permitido.')
    require(bool(result), 'No se respalda un volumen MinIO vacío.')
    return result


def restore_archive(archive, target, expected):
    """Extract only regular files/directories below an empty, private restore directory."""
    with tarfile.open(archive, 'r:gz') as source:
        names = set()
        for member in source:
            name = pathlib.PurePosixPath(member.name)
            require(not name.is_absolute() and '..' not in name.parts, 'Ruta insegura en el respaldo MinIO.')
            require(member.isfile() or member.isdir(), 'Tipo de archivo inseguro en el respaldo MinIO.')
            destination = target.joinpath(*name.parts)
            require(destination.resolve().is_relative_to(target.resolve()), 'Ruta fuera del directorio de restauración.')
            if member.isdir():
                destination.mkdir(parents=True, exist_ok=True)
            else:
                require(member.name not in names, 'Archivo duplicado en el respaldo MinIO.')
                names.add(member.name)
                destination.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as incoming, destination.open('xb') as outgoing:
                    shutil.copyfileobj(incoming, outgoing)
    require(inventory(target) == expected, 'La extracción MinIO no coincide con los archivos respaldados.')


class Postgres:
    def __init__(self, diagnostic, ci_url=None):
        self.diagnostic = diagnostic
        self.env = None
        self.is_ci = ci_url is not None
        self.prefix = ['kubectl', '-n', NAMESPACE, 'exec', '-i', 'postgres-0', '-c', 'postgres', '--', 'sh', '-ec']
        if ci_url is not None:
            url = urlsplit(ci_url)
            require(os.environ.get('CI') == 'true' and url.scheme in ('postgres', 'postgresql')
                    and url.hostname in ('localhost', '127.0.0.1', '::1') and url.path == '/inmobiliaria_ci',
                    'La prueba integrada solo admite CI y la base desechable de loopback.')
            self.env = dict(os.environ, PGHOST=url.hostname, PGPORT=str(url.port or 5432),
                            PGPASSWORD=unquote(url.password or ''), POSTGRES_USER=unquote(url.username or ''), POSTGRES_DB='inmobiliaria_ci')
            self.prefix = ['sh', '-ec']
            container = os.environ.get('BACKUP_CI_POSTGRES_CONTAINER')
            if container:
                require(bool(re.fullmatch('[a-f0-9]{64}', container)), 'Contenedor PostgreSQL de CI inválido.')
                self.prefix = ['docker', 'exec', '-i', container, 'sh', '-ec']
                self.env = None

    def execute(self, command, *, source=None, target=None):
        if self.is_ci:
            command = 'test "$POSTGRES_DB" = inmobiliaria_ci; ' + command
        with self.diagnostic.open('ab') as errors:
            result = subprocess.run(self.prefix + [command], stdin=source, stdout=target or subprocess.PIPE,
                                    stderr=errors, env=self.env, timeout=900, check=False)
        require(result.returncode == 0, 'Falló PostgreSQL; consulte el diagnóstico privado del respaldo.')
        return result.stdout

    def dump(self, target):
        with target.open('wb') as stream:
            self.execute('pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges', target=stream)

    def restore_check(self, dump):
        database = 'inmo_restore_check_' + uuid.uuid4().hex
        # This generated name is the only restore/drop target; it never comes from input or credentials.
        require(bool(re.fullmatch('inmo_restore_check_[a-f0-9]{32}', database)), 'Base temporal inválida.')
        self.execute(f'createdb -U "$POSTGRES_USER" {database}')
        try:
            with dump.open('rb') as stream:
                self.execute(f'pg_restore -U "$POSTGRES_USER" -d {database} --no-owner --no-privileges --exit-on-error', source=stream)
            query = "SELECT json_build_object('users',(SELECT count(*) FROM \"User\"),'invoices',(SELECT count(*) FROM \"Invoice\"),'payments',(SELECT count(*) FROM \"Payment\"),'files',(SELECT count(*) FROM \"StoredFile\"),'migrations',(SELECT count(*) FROM _prisma_migrations))"
            counts = json.loads(self.execute(f'psql -U "$POSTGRES_USER" -d {database} -X -v ON_ERROR_STOP=1 -Atc {shlex.quote(query)}'))
            require(set(counts) == {'users', 'invoices', 'payments', 'files', 'migrations'}
                    and all(isinstance(value, int) and value >= 0 for value in counts.values())
                    and counts['migrations'] > 0, 'La base restaurada no contiene el esquema esperado.')
            return counts
        finally:
            self.execute(f'dropdb -U "$POSTGRES_USER" {database}')


def save_configuration(directory):
    for resource in RESOURCES:
        with (directory / (resource + '.yaml')).open('wb') as stream, (directory / 'diagnostic.log').open('ab') as errors:
            result = subprocess.run(['kubectl', '-n', NAMESPACE, 'get', resource, '-o', 'yaml'], stdout=stream, stderr=errors, timeout=60, check=False)
        require(result.returncode == 0, 'No se pudo respaldar la configuración del clúster.')
    for name, path in PROTECTED.items():
        require(path.is_file() and not path.is_symlink(), 'Falta configuración protegida del VPS.')
        shutil.copyfile(path, directory / name)


def create_backup(sha, backups, volume, *, backend=None, configuration=save_configuration):
    require(bool(re.fullmatch('[a-f0-9]{40}', sha)), 'Se exige el SHA completo.')
    backups.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory = pathlib.Path(tempfile.mkdtemp(prefix=sha + '-', dir=backups))
    try:
        before = inventory(volume)
        size = sum((volume / name).stat().st_size for name in before)
        require(shutil.disk_usage(backups).free > size * 3 + 1024 ** 3, 'Espacio insuficiente para respaldar y verificar MinIO.')
        pg = backend or Postgres(directory / 'diagnostic.log')
        pg.dump(directory / POSTGRES_DUMP)
        restored_counts = pg.restore_check(directory / POSTGRES_DUMP)
        with tarfile.open(directory / MINIO_ARCHIVE, 'w:gz') as archive:
            archive.add(volume, arcname='.', recursive=True)
        with tempfile.TemporaryDirectory(prefix='restore-', dir=directory) as temporary:
            restore_archive(directory / MINIO_ARCHIVE, pathlib.Path(temporary), before)
        require(inventory(volume) == before, 'MinIO cambió durante el respaldo; no se despliega y debe repetirse.')
        configuration(directory)
        checksums = {path.name: digest(path) for path in sorted(directory.iterdir()) if path.is_file()}
        (directory / CHECKSUM_INDEX).write_text(json.dumps(checksums, sort_keys=True), encoding='utf-8')
        report = {'version': 1, 'sha': sha, 'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'postgres_restore_verified': True, 'postgres_restored_counts': restored_counts,
                  'minio_restore_verified': True, 'minio_files_verified': len(before),
                  'checksums_sha256': digest(directory / CHECKSUM_INDEX)}
        # A failed operation never creates the receipt consumed by deployment.
        receipt = directory / VERIFIED_RECEIPT
        receipt.write_text(json.dumps(report, sort_keys=True), encoding='utf-8')
        receipt.chmod(0o600)
        verify_backup(sha, receipt, backups)
        return receipt
    except Exception:
        (directory / 'failed.json').write_text(json.dumps({'sha': sha, 'failed_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}), encoding='utf-8')
        (directory / VERIFIED_RECEIPT).unlink(missing_ok=True)
        raise


def verify_backup(sha, receipt, backups, *, now=None):
    require(bool(re.fullmatch('[a-f0-9]{40}', sha)), 'Se exige el SHA completo.')
    receipt = pathlib.Path(receipt)
    require(receipt.is_absolute() and receipt.name == VERIFIED_RECEIPT and not receipt.is_symlink(), 'Recibo de respaldo inválido.')
    directory = receipt.parent
    require(directory.parent.resolve() == backups.resolve() and not directory.is_symlink(), 'El respaldo debe estar en su directorio protegido.')
    require(directory.stat().st_mode & 0o077 == 0 and receipt.stat().st_mode & 0o077 == 0, 'El respaldo no es privado.')
    require(not (directory / 'failed.json').exists(), 'Un respaldo fallido no autoriza despliegues.')
    report = json.loads(receipt.read_text(encoding='utf-8'))
    require(report.get('version') == 1 and report.get('sha') == sha, 'El respaldo no corresponde al SHA solicitado.')
    require(report.get('postgres_restore_verified') is True and report.get('minio_restore_verified') is True
            and report.get('minio_files_verified', 0) > 0, 'El respaldo no pasó ambas restauraciones.')
    created = datetime.datetime.fromisoformat(report['created_at'])
    age = ((now or datetime.datetime.now(datetime.timezone.utc)) - created).total_seconds()
    require(0 <= age < 3600, 'Se requiere un respaldo verificado reciente.')
    checksums = json.loads((directory / CHECKSUM_INDEX).read_text(encoding='utf-8'))
    require(digest(directory / CHECKSUM_INDEX) == report.get('checksums_sha256'), 'El índice de integridad está corrupto.')
    require({POSTGRES_DUMP, MINIO_ARCHIVE} <= checksums.keys(), 'Faltan los archivos de datos respaldados.')
    for name, expected in checksums.items():
        require(pathlib.PurePath(name).name == name and name not in ('.', '..'), 'Ruta de archivo de respaldo inválida.')
        path = directory / name
        require(path.is_file() and not path.is_symlink() and digest(path) == expected, 'Un archivo del respaldo cambió o está corrupto.')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('create', 'verify', 'ci'))
    parser.add_argument('sha')
    parser.add_argument('receipt', nargs='?')
    args = parser.parse_args()
    os.umask(0o077)
    if args.mode == 'ci':
        # Validate the connection before creating a fixture or invoking database commands.
        Postgres(pathlib.Path('/dev/null'), os.environ.get('DATABASE_URL', ''))
        with tempfile.TemporaryDirectory(prefix='inmo-backup-ci-') as temporary:
            root = pathlib.Path(temporary)
            volume = root / 'minio'
            (volume / '.minio.sys').mkdir(parents=True)
            (volume / '.minio.sys' / 'metadata').write_bytes(b'synthetic minio metadata')
            (volume / 'receipt.pdf').write_bytes(b'%PDF-1.4 synthetic backup fixture')
            receipt = create_backup(args.sha, root / 'backups', volume,
                                    backend=Postgres(root / 'pg-diagnostic.log', os.environ['DATABASE_URL']), configuration=lambda directory: None)
            verify_backup(args.sha, receipt, root / 'backups')
            print('CI: PostgreSQL restaurado en base aislada y MinIO extraído con integridad verificada.')
        return
    require(os.geteuid() == 0, 'El respaldo de producción requiere root en el VPS.')
    if args.mode == 'verify':
        verify_backup(args.sha, pathlib.Path(args.receipt or ''), BACKUPS)
        print('Respaldo previo: SHA, antigüedad, restauraciones e integridad verificados.')
    else:
        import fcntl
        with LOCK.open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            receipt = create_backup(args.sha, BACKUPS, MINIO)
        print('Respaldo previo creado y restauraciones verificadas; evidencia privada: ' + str(receipt), file=sys.stderr)
        print(receipt)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Respaldo obligatorio falló; despliegue bloqueado: ' + str(error), file=sys.stderr)
        raise SystemExit(1) from None
