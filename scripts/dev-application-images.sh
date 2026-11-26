# Helpers for the two runner-built images admitted by verify-dev-application.py.
import_dev_images() {
  local archive=$1 sha=$2 pins=${3:-} component ref existing_pins refs
  gzip -dc "$archive" | ctr -n k8s.io images import --platform linux/amd64 -
  refs=$(ctr -n k8s.io images ls -q)
  if [[ -n "$pins" ]]; then
    existing_pins=$(ctr -n k8s.io images ls -q 'labels."io.cri-containerd.pinned"==pinned')
  fi
  for component in api web; do
    ref="docker.io/library/asesoria-inmobiliaria-$component:dev-$sha"
    grep -Fxq "$ref" <<< "$refs" || return 1
    if [[ -n "$pins" ]] && ! grep -Fxq "$ref" <<< "$existing_pins"; then
      printf '%s\n' "$ref" >> "$pins"
      ctr -n k8s.io images label "$ref" io.cri-containerd.pinned=pinned >/dev/null
    fi
  done
  echo "Imágenes de la API y de la web de DEV verificadas e importadas para $sha."
}

release_dev_image_pins() {
  local pins=$1 ref
  [[ -f "$pins" ]] || return 0
  while IFS= read -r ref; do
    ctr -n k8s.io images label "$ref" io.cri-containerd.pinned= >/dev/null || echo "No se pudo liberar la protección temporal de $ref." >&2
  done < "$pins"
}
