#!/usr/bin/env bash
set -euo pipefail

namespace=asesoria-inmobiliaria-dev
job="${1:-}"
[[ -z "$job" || "$job" =~ ^(postgres-app-role|minio-app-policy)-[0-9]+$ ]] || exit 2
kubectl -n "$namespace" get deployment api web minio -o 'custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,IMAGE:.spec.template.spec.containers[0].image'
if [[ -r /var/lib/asesoria-inmobiliaria-dev/verified-sha ]]; then
  read -r receipt < /var/lib/asesoria-inmobiliaria-dev/verified-sha
  if [[ "$receipt" =~ ^[a-f0-9]{40}$ ]]; then printf 'Último SHA verificado en DEV: %s\n' "$receipt"; fi
fi
df -Pk /var/lib/asesoria-inmobiliaria-dev | awk 'NR == 2 {print "Disco de DEV: " $4 " KiB disponibles, uso " $5}'
if [[ -n "$job" ]]; then
  kubectl -n "$namespace" get "job/$job" -o 'custom-columns=JOB:.metadata.name,CONDICION:.status.conditions[*].type,CAUSA:.status.conditions[*].reason'
  kubectl -n "$namespace" get pods -l "job-name=$job" -o 'custom-columns=POD:.metadata.name,FASE:.status.phase,CAUSA:.status.reason,ESPERA:.status.containerStatuses[*].state.waiting.reason,FIN:.status.containerStatuses[*].state.terminated.reason,SALIDA:.status.containerStatuses[*].state.terminated.exitCode'
fi
# Print only Kubernetes identifiers and recognized causes. Event messages can
# include provider output and private resource details.
kubectl -n "$namespace" get events --field-selector type=Warning --sort-by=.lastTimestamp \
  -o 'custom-columns=OBJECT:.involvedObject.name,REASON:.reason,MESSAGE:.message' --no-headers |
  awk '$1 ~ /^(minio|postgres|asesoria-migrate|api-|web-)/ {
    cause=""; line=tolower($0)
    if (line ~ /disk-pressure|diskpressure|ephemeral-storage|no space left/) cause="disco"
    else if (line ~ /memorypressure|memory-pressure|insufficient memory|out of memory|low on resource: memory/) cause="memoria"
    else if (line ~ /insufficient cpu/) cause="cpu"
    else if (line ~ /pull image|pulling image|imagepull/) cause="descarga de imagen"
    else if (line ~ /taint/) cause="restricción del nodo"
    print $1, $2, cause
  }' | tail -18
