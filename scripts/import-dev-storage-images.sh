#!/usr/bin/env bash
set -euo pipefail

# Only the development deployment invokes this receiver, after the SHA gate.
release="${1:-}"
repo="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -t 0 ]]; then [[ -z "$release" ]] && exit 0; exit 2; fi
read_header() {
  header=''
  if ! IFS= read -r -n 32 header; then
    [[ -z "$header" ]] || exit 2
  fi
}
read_header
if [[ "$header" == JB-DEV-SPACE-1 ]]; then
  (cd "$repo" && python3 scripts/reclaim-dev-images.py)
  read_header
fi
if [[ -n "$release" ]]; then
  [[ "$header" == JB-DEV-APP-1 ]] || { echo 'Falta el paquete de aplicación de DEV.' >&2; exit 2; }
  (
    umask 077
    archive="$(mktemp)"
    trap 'rm -f -- "$archive"' EXIT
    timeout 900 python3 "$repo/scripts/verify-dev-application.py" "$release" "$archive"
    gzip -dc "$archive" | ctr -n k8s.io images import -
    registry="$(ctr -n k8s.io images ls -q)"
    for component in api web; do
      grep -Fxq "docker.io/library/asesoria-inmobiliaria-$component:dev-$release" <<< "$registry"
    done
    echo "Imágenes de la API y de la web de DEV verificadas e importadas para $release."
  )
  read_header
fi
[[ -n "$header" ]] || exit 0
[[ "$header" == JB-DEV-MINIO-1 ]] || { echo 'Cabecera de importación DEV inválida.' >&2; exit 2; }
[[ "$(uname -sm)" == 'Linux x86_64' ]] || exit 2
umask 077
folder="$(mktemp -d)"
trap 'rm -f "$folder/jb-dev-minio.oci.tar"; rmdir "$folder"' EXIT
receipt="$(cd "$(dirname "$0")/../docker/minio" && pwd)/dev-images.sha256"
cd "$folder"
expected_bytes=84869120
timeout 300 head -c "$((expected_bytes + 1))" > jb-dev-minio.oci.tar
[[ "$(wc -c < jb-dev-minio.oci.tar)" -eq "$expected_bytes" ]] || { echo 'Longitud del paquete DEV inválida.' >&2; exit 1; }
sha256sum --check --strict "$receipt"

namespace=asesoria-inmobiliaria-dev
server='quay.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e'
client='quay.io/minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727'
active_image="$(kubectl -n "$namespace" get deploy/minio -o 'jsonpath={.spec.template.spec.containers[?(@.name=="minio")].image}')"
printf 'Imagen declarada por MinIO DEV: %s\n' "$active_image"
[[ "$active_image" == "$server" ]] || { echo 'La imagen activa de DEV requiere revisión.' >&2; exit 1; }
ctr -n k8s.io images import --platform linux/amd64 jb-dev-minio.oci.tar
registered="$(ctr -n k8s.io images ls -q)"
for reference in "$server" "$client"; do
  grep -Fxq "$reference" <<< "$registered"
done
echo 'Las dos imágenes de MinIO están registradas en el runtime de DEV.'
if [[ "$(kubectl -n "$namespace" get deploy/minio -o 'jsonpath={.status.readyReplicas}')" != 1 ]]; then
  kubectl -n "$namespace" rollout restart deployment/minio
fi
