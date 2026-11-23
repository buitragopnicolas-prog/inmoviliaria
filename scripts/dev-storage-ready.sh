#!/usr/bin/env bash
set -euo pipefail

# DEV declares one MinIO replica backed by a retained persistent volume.
namespace=asesoria-inmobiliaria-dev
status() {
  kubectl -n "$namespace" get deploy/minio -o 'custom-columns=NAME:.metadata.name,DESIRED:.spec.replicas,READY:.status.readyReplicas' || true
  kubectl -n "$namespace" get pods -l app=minio -o 'custom-columns=NAME:.metadata.name,PHASE:.status.phase,WAITING:.status.containerStatuses[*].state.waiting.reason,LAST_EXIT:.status.containerStatuses[*].lastState.terminated.reason,INIT:.status.initContainerStatuses[*].state.waiting.reason' || true
  kubectl -n "$namespace" get pvc/minio-pvc -o 'custom-columns=NAME:.metadata.name,PHASE:.status.phase' || true
}
case "${1:-}" in
  --status) status; exit 0 ;;
  '') ;;
  *) exit 2 ;;
esac
if ! replicas="$(kubectl -n "$namespace" get deployment/minio -o 'jsonpath={.spec.replicas}')"; then
  status
  exit 1
fi
if [[ "$replicas" == 0 ]]; then
  kubectl -n "$namespace" scale deployment/minio --current-replicas=0 --replicas=1
fi
if ! kubectl -n "$namespace" rollout status deployment/minio --timeout=180s; then
  status
  exit 1
fi
for attempt in {1..10}; do
  if [[ -n "$(kubectl -n "$namespace" get endpoints/minio-service -o 'jsonpath={.subsets[*].addresses[*].ip}')" ]]; then
    echo 'El servicio de almacenamiento DEV tiene un destino disponible.'
    exit 0
  fi
  sleep 2
done
status
echo 'El servicio de MinIO en DEV carece de un destino listo.' >&2
exit 1
