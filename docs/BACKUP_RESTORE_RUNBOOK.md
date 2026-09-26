# Procedimiento de respaldo y restauración aislada

Este procedimiento cubre PostgreSQL y MinIO. Nunca debe ejecutarse una restauración sobre DEV o producción. El respaldo informado en `/var/lib/asesoria-inmobiliaria/backups/20260925T035332Z` es evidencia externa y no fue leído ni modificado durante esta auditoría.

## Preparación

1. Cree un directorio nuevo con permisos restringidos y registre fecha, entorno, versión de PostgreSQL/MinIO y SHA de la aplicación.
2. Use credenciales de respaldo separadas y de solo lectura cuando el proveedor lo permita.
3. No incluya secretos en nombres de archivo, comandos almacenados o logs.
4. Calcule SHA-256 de cada artefacto y guarde el manifiesto fuera del mismo volumen.

## PostgreSQL: backup y verificación

Ejemplo conceptual para un archivo custom de `pg_dump`:

```sh
pg_dump --format=custom --no-owner --no-privileges --file=postgres.dump "$DATABASE_URL"
sha256sum postgres.dump > SHA256SUMS
pg_restore --list postgres.dump > postgres.contents.txt
test -s postgres.contents.txt
sha256sum --check SHA256SUMS
```

La URL debe llegar por el gestor de secretos. No la escriba en el repositorio ni en el historial del shell.

## MinIO: backup y verificación

```sh
mc mirror --preserve source/inmobiliaria-assets ./minio/inmobiliaria-assets
find ./minio/inmobiliaria-assets -type f -print0 | sort -z | xargs -0 sha256sum > minio.sha256
sha256sum --check minio.sha256
```

Registre también la política del bucket y confirme que el acceso anónimo permanece deshabilitado. Cifre el respaldo antes de sacarlo del host y proteja la clave por separado.

## Restauración de prueba

1. Cree PostgreSQL y MinIO vacíos en una red aislada, sin ingress ni acceso de clientes.
2. Restaure PostgreSQL en una base nueva:

```sh
createdb "$RESTORE_DATABASE_NAME"
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" postgres.dump
```

3. Restaure objetos en un bucket nuevo y privado:

```sh
mc mb --ignore-existing restore/inmobiliaria-assets-restore
mc anonymous set none restore/inmobiliaria-assets-restore
mc mirror --preserve ./minio/inmobiliaria-assets restore/inmobiliaria-assets-restore
```

4. Ejecute las migraciones con la misma imagen de API que se desea promover.
5. Valide conteos de tablas críticas (`User`, `Lease`, `Invoice`, `Payment`, `PaymentAuditEvent`, `StoredFile`) y compare una muestra de checksums de objetos.
6. Inicie la API apuntando solo al entorno restaurado y verifique `/api/health/ready`, autenticación, facturas propias, contrato propio, comprobante propio y denegaciones entre usuarios.
7. Destruya únicamente el entorno temporal después de conservar el acta de prueba.

## Criterio de aprobación

El respaldo queda validado cuando hashes, restauración, migraciones, conteos, objetos privados y smoke tests coinciden. La existencia del archivo por sí sola no constituye una restauración verificada.

