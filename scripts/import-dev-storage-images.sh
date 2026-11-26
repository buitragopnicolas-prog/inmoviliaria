#!/usr/bin/env bash
set -euo pipefail

# Only the development deployment invokes this receiver, after the SHA gate.
release="${1:-}"
repo="$(cd "$(dirname "$0")/.." && pwd)"
source "$repo/scripts/dev-application-images.sh"
if [[ -t 0 ]]; then [[ -z "$release" ]] && exit 0; exit 2; fi
read_header() {
  header=''
  if ! IFS= read -r -n 32 header; then
    [[ -z "$header" ]] || exit 2
  fi
}
read_header
reclaim_authorized=false
if [[ "$header" == JB-DEV-SPACE-1 ]]; then
  reclaim_authorized=true
  (cd "$repo" && python3 scripts/reclaim-dev-images.py)
  read_header
fi
if [[ "$header" == JB-DEV-QA-1 ]]; then
  [[ -n "$release" && -n "${2:-}" ]] || exit 2
  IFS= read -r -n 1025 payload
  [[ ${#payload} -le 1024 ]] || exit 2
  (umask 077; printf '%s' "$payload" > "$2")
  unset payload
  read_header
fi
if [[ -n "$release" ]]; then
  [[ "$header" == JB-DEV-APP-1 ]] || { echo 'Falta el paquete de aplicación de DEV.' >&2; exit 2; }
  if [[ -n "${3:-}" ]]; then
    # Retain the verified bytes in the release's private temporary directory until the node is ready.
    (umask 077; timeout 900 python3 "$repo/scripts/verify-dev-application.py" "$release" "$3/application.tar.gz")
    if [[ "$reclaim_authorized" == true ]]; then touch "$3/reclaim-authorized"; fi
  else
    (
      umask 077
      archive="$(mktemp)"
      trap 'rm -f -- "$archive"' EXIT
      timeout 900 python3 "$repo/scripts/verify-dev-application.py" "$release" "$archive"
      import_dev_images "$archive" "$release"
    )
    if [[ "$reclaim_authorized" == true ]]; then
      (cd "$repo" && python3 scripts/reclaim-dev-images.py)
    fi
  fi
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
