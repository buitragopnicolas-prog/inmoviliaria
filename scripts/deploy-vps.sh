#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo 'Uso: deploy-vps.sh dev|prod RELEASE' >&2
  exit 2
fi
stage="$1"
release="$2"
[[ "$stage" == dev || "$stage" == prod ]] || exit 2
[[ "$release" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]{5,39}$ ]] || exit 2
if [[ "$stage" == prod && ! "$release" =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Producción exige el SHA completo de un commit.' >&2
  exit 2
fi

exec 9>/run/lock/asesoria-inmobiliaria-deploy.lock
flock 9
repo="$(cd "$(dirname "$0")/.." && pwd)"
namespace=asesoria-inmobiliaria
domain=asesoriainmobiliariajb.com
if [[ "$stage" == dev ]]; then
  namespace=asesoria-inmobiliaria-dev
  domain=dev.asesoriainmobiliariajb.com
fi
tag="$stage-$release"
api_image="asesoria-inmobiliaria-api:$tag"
web_image="asesoria-inmobiliaria-web:$tag"
manifest="$(mktemp)"
job_file="$(mktemp)"
trap 'rm -f "$manifest" "$job_file"' EXIT

kubectl -n "$namespace" get secret asesoria-secrets >/dev/null
kubectl -n "$namespace" get service postgres-service minio-service >/dev/null
kubectl kustomize "$repo/k8s/overlays/$stage" | sed "s/RELEASE_TAG/$tag/g" > "$manifest"
if grep -q RELEASE_TAG "$manifest"; then
  echo 'Quedó un marcador de imagen sin resolver.' >&2
  exit 1
fi
if [[ "$stage" == prod ]]; then
  if [[ ! -f /root/asesoria-production-approved-sha ]] ||
     [[ "$(cat /root/asesoria-production-approved-sha)" != "$release" ]]; then
    echo 'Falta aprobación explícita del SHA para producción en el VPS.' >&2
    exit 1
  fi
  node "$repo/scripts/payment-config-policy.mjs" "$manifest"
  if [[ ! -f /var/lib/asesoria-inmobiliaria-dev/verified-sha ]] ||
     [[ "$(cat /var/lib/asesoria-inmobiliaria-dev/verified-sha)" != "$release" ]]; then
    echo 'El SHA no pasó verificación completa en dev.' >&2
    exit 1
  fi
  current_dev_image="$(kubectl -n asesoria-inmobiliaria-dev get deploy api -o jsonpath='{.spec.template.spec.containers[0].image}')"
  if [[ "$current_dev_image" != "asesoria-inmobiliaria-api:dev-$release" ]]; then
    echo 'Dev ya no ejecuta el SHA que se intenta promover.' >&2
    exit 1
  fi
fi

echo "Construyendo $tag para $stage"
docker build -f "$repo/apps/api/Dockerfile" -t "$api_image" "$repo"
docker build -f "$repo/apps/web/Dockerfile" \
  --build-arg "NEXT_PUBLIC_API_URL=https://$domain" -t "$web_image" "$repo"
docker save "$api_image" | ctr -n k8s.io images import -
docker save "$web_image" | ctr -n k8s.io images import -

kubectl apply -f "$manifest" -l deployment-phase=config
job_name="asesoria-migrate-$(date +%s)"
cat > "$job_file" <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: $job_name
  namespace: $namespace
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 600
  ttlSecondsAfterFinished: 86400
  template:
    metadata:
      labels:
        job-role: db-init
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: $api_image
          imagePullPolicy: IfNotPresent
          command: ["npm", "run", "db:migrate", "-w", "@inmobiliaria/api"]
          envFrom:
            - configMapRef: { name: asesoria-config }
            - secretRef: { name: asesoria-secrets }
EOF
kubectl apply -f "$job_file"
if ! kubectl -n "$namespace" wait --for=condition=complete "job/$job_name" --timeout=600s; then
  kubectl -n "$namespace" logs "job/$job_name" --tail=100 || true
  exit 1
fi

if [[ "$stage" == dev && ! -f /var/lib/asesoria-inmobiliaria-dev/seeded ]]; then
  seed_job="asesoria-seed-dev-$(date +%s)"
  sed "s/$job_name/$seed_job/; s/\[\"npm\", \"run\", \"db:migrate\"/\[\"npm\", \"run\", \"db:seed\"/" "$job_file" > "$manifest.seed"
  kubectl apply -f "$manifest.seed"
  rm -f "$manifest.seed"
  if ! kubectl -n "$namespace" wait --for=condition=complete "job/$seed_job" --timeout=600s; then
    kubectl -n "$namespace" logs "job/$seed_job" --tail=100 || true
    exit 1
  fi
  touch /var/lib/asesoria-inmobiliaria-dev/seeded
fi

kubectl apply -f "$manifest"
kubectl -n "$namespace" rollout status deployment/api --timeout=300s
kubectl -n "$namespace" rollout status deployment/web --timeout=300s
smoke_ok=false
for attempt in {1..30}; do
  if curl --fail --silent --max-time 5 -H "Host: $domain" http://127.0.0.1:30080/api/health/ready >/dev/null &&
     curl --fail --silent --max-time 5 -H "Host: $domain" http://127.0.0.1:30080/api/properties >/dev/null &&
     curl --fail --silent --max-time 5 -H "Host: $domain" http://127.0.0.1:30080/ >/dev/null; then
    smoke_ok=true
    break
  fi
  sleep 2
done
if [[ "$smoke_ok" != true ]]; then
  echo "Fallaron las pruebas HTTP de $stage." >&2
  exit 1
fi

if [[ "$stage" == dev && "$release" =~ ^[a-f0-9]{40}$ ]]; then
  printf '%s\n' "$release" > /var/lib/asesoria-inmobiliaria-dev/verified-sha
fi
echo "$stage $release verificado"
