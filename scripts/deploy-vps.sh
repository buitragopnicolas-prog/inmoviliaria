#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo 'Uso: deploy-vps.sh dev|prod RELEASE' >&2
  exit 2
fi
stage="$1"
release="$2"
[[ "$stage" == dev || "$stage" == prod ]] || exit 2
if [[ ! "$release" =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Dev y producción exigen el SHA completo aprobado por Sonar.' >&2
  exit 2
fi

exec 9>/run/lock/asesoria-inmobiliaria-deploy.lock
flock 9
repo="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$(git -C "$repo" rev-parse HEAD)" != "$release" ]] ||
   [[ -n "$(git -C "$repo" status --porcelain --untracked-files=normal)" ]]; then
  echo 'El código debe coincidir con el commit aprobado y no tener cambios locales.' >&2
  exit 1
fi
# Protected server configuration, independent of the checked-out release.
# Fail before building images, modifying secrets or applying migrations.
export PATH="/opt/asesoria-inmobiliaria/sonar/runtime/bin:$PATH"
node --env-file=/etc/asesoria-inmobiliaria/sonar.env "$repo/scripts/sonar-gate.mjs" "$release"
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
payment_overlay="$(mktemp -d)"
trap 'rm -f "$manifest" "$job_file"; rm -rf "$payment_overlay"' EXIT

payment_config=/etc/asesoria-inmobiliaria/manual-payments.json
qr_asset=/opt/asesoria-inmobiliaria/payments/bancolombia-breb.jpeg
[[ "$(stat -c '%u:%a' "$payment_config")" == '0:600' ]] || {
  echo 'La configuración manual debe pertenecer a root con permisos 600.' >&2
  exit 1
}
[[ -f "$qr_asset" ]] || { echo 'No existe el QR autorizado en el VPS.' >&2; exit 1; }
node --input-type=module - "$payment_config" "$payment_overlay" "$repo" "$stage" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const [configPath, overlay, repo, stage] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (config.apiVersion !== 'v1' || config.kind !== 'ConfigMap' || config.metadata?.name !== 'asesoria-config' ||
    Object.keys(config).some(key => !['apiVersion', 'kind', 'metadata', 'data'].includes(key)) ||
    Object.keys(config.metadata).some(key => key !== 'name') ||
    !config.data || Object.entries(config.data).some(([key, value]) =>
      !(['PAYMENT_MODE', 'PAYMENT_GATEWAY'].includes(key) || /^MANUAL_PAYMENT_[A-Z_]+$/.test(key)) || typeof value !== 'string') ||
    config.data.PAYMENT_MODE !== 'manual' || config.data.PAYMENT_GATEWAY !== 'none' ||
    config.data.MANUAL_PAYMENT_QR_IMAGE_URL !== '/payments/bancolombia-breb.jpeg') {
  throw new Error('El parche protegido solo admite configuración de pagos manuales autorizados.');
}
fs.writeFileSync(`${overlay}/kustomization.yaml`, JSON.stringify({
  apiVersion: 'kustomize.config.k8s.io/v1beta1', kind: 'Kustomization',
  resources: [path.relative(overlay, `${repo}/k8s/overlays/${stage}`)],
  patches: [{target: {kind: 'ConfigMap', name: 'asesoria-config'}, path: configPath}],
}));
NODE
payment_fingerprint="$(sha256sum "$payment_config" "$qr_asset" | sha256sum | cut -d' ' -f1)"

kubectl -n "$namespace" get secret asesoria-secrets >/dev/null
kubectl -n "$namespace" get service postgres-service minio-service >/dev/null
if [[ "$stage" == dev ]]; then
  bash "$repo/scripts/prepare-dev-security.sh"
fi
kubectl kustomize "$payment_overlay" --load-restrictor LoadRestrictionsNone | sed "s/RELEASE_TAG/$tag/g" > "$manifest"
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
  if [[ ! -f /var/lib/asesoria-inmobiliaria-dev/verified-manual-payment-config-sha ]] ||
     [[ "$(cat /var/lib/asesoria-inmobiliaria-dev/verified-manual-payment-config-sha)" != "$payment_fingerprint" ]]; then
    echo 'Los datos de pagos o el QR no coinciden con los verificados en dev.' >&2
    exit 1
  fi
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
kubectl -n "$namespace" rollout status deployment/clamav --timeout=600s
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

if [[ "$stage" == dev ]]; then
  python3 "$repo/scripts/smoke-dev-vps.py" --upload
fi

if [[ "$stage" == dev && "$release" =~ ^[a-f0-9]{40}$ ]]; then
  printf '%s\n' "$release" > /var/lib/asesoria-inmobiliaria-dev/verified-sha
  printf '%s\n' "$payment_fingerprint" > /var/lib/asesoria-inmobiliaria-dev/verified-manual-payment-config-sha
fi
echo "$stage $release verificado"
