#!/usr/bin/env bash
set -euo pipefail

[[ -n "${JB_DEV_MINIO_TRANSFER:-}" ]] || exit 0
umask 077
staging="$(mktemp -d "$RUNNER_TEMP/jb-dev-storage.XXXXXXXX")"
trap 'rm -rf -- "$staging"' EXIT
destination="$RUNNER_TEMP/jb-dev-minio.oci.tar"
[[ ! -e "$destination" ]]
url="$(jq -er '.url | select(type=="string")' <<< "$JB_DEV_MINIO_TRANSFER")"
[[ "$url" == https://release-assets.githubusercontent.com/* ]] || exit 2
# Keep the short-lived URL and passphrase out of logs. GPG verifies the ciphertext.
curl --proto '=https' --fail --silent --max-time 240 --max-filesize 85000000 \
  --output "$staging/cipher.gpg" "$url" || { echo 'No se pudo descargar el paquete temporal de DEV.' >&2; exit 1; }
mkdir -m 700 "$staging/gnupg"
jq -er '.passphrase | select(type=="string" and length==64)' <<< "$JB_DEV_MINIO_TRANSFER" |
  gpg --homedir "$staging/gnupg" --batch --pinentry-mode loopback --passphrase-fd 0 \
    --no-symkey-cache --output "$staging/jb-dev-minio.oci.tar" --decrypt "$staging/cipher.gpg"
receipt="$(cd "$(dirname "$0")/../docker/minio" && pwd)/dev-images.sha256"
(cd "$staging" && sha256sum --check --strict "$receipt")
mv -- "$staging/jb-dev-minio.oci.tar" "$destination"
