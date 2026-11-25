#!/bin/sh
# Runs inside the ready DEV MinIO replica. Credentials arrive only over stdin.
set -eu
umask 077
IFS= read -r root_user
IFS= read -r root_password
IFS= read -r app_user
IFS= read -r app_password
MC_CONFIG_DIR=$(mktemp -d)
export MC_CONFIG_DIR
trap 'rm -rf -- "$MC_CONFIG_DIR"' EXIT
trap 'exit 1' HUP INT TERM
cat > "$MC_CONFIG_DIR/app-policy.json"
endpoint=http://127.0.0.1:9000
bucket=inmobiliaria-assets
policy=inmobiliaria-app-policy
probe="$bucket/security/dev-probe-${MC_CONFIG_DIR##*/}.txt"

echo 'JB_MINIO configuración del bucket privado'
mc alias set root "$endpoint" "$root_user" "$root_password" >/dev/null
mc mb --ignore-existing "root/$bucket" >/dev/null
mc anonymous set none "root/$bucket" >/dev/null

echo 'JB_MINIO configuración de la cuenta y de su política'
mc admin user add root "$app_user" "$app_password" >/dev/null
mc admin policy create root "$policy" "$MC_CONFIG_DIR/app-policy.json" >/dev/null
mc admin policy attach root "$policy" --user "$app_user" >/dev/null
mc alias set app "$endpoint" "$app_user" "$app_password" >/dev/null

echo 'JB_MINIO comprobación de lectura, escritura y privilegios'
printf '%s' dev-security-probe | mc pipe "app/$probe" >/dev/null
trap 'mc rm "app/$probe" >/dev/null 2>&1; rm -rf -- "$MC_CONFIG_DIR"' EXIT
test "$(mc cat "app/$probe")" = dev-security-probe
if mc admin info app >/dev/null 2>&1; then
  echo 'La cuenta de la aplicación recibió privilegios administrativos.' >&2
  exit 1
fi
mc rm "app/$probe" >/dev/null
trap 'rm -rf -- "$MC_CONFIG_DIR"' EXIT
