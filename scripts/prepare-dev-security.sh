#!/usr/bin/env bash
set -euo pipefail

namespace=asesoria-inmobiliaria-dev
secret_file=/root/asesoria-inmobiliaria-dev-secrets.env
repo="$(cd "$(dirname "$0")/.." && pwd)"
mode="${1:-full}"
[[ "$mode" == full || "$mode" == --secrets-only ]] || { echo 'Modo inválido.' >&2; exit 2; }
[[ -f "$secret_file" ]] || { echo 'No existe el archivo privado de secretos DEV.' >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$secret_file"
set +a

DATABASE_MIGRATION_URL="${DATABASE_MIGRATION_URL:-$DATABASE_URL}"
POSTGRES_APP_USER="${POSTGRES_APP_USER:-inmobiliaria_app}"
POSTGRES_APP_PASSWORD="${POSTGRES_APP_PASSWORD:-$(openssl rand -hex 24)}"
DATABASE_URL="postgresql://${POSTGRES_APP_USER}:${POSTGRES_APP_PASSWORD}@postgres-service:5432/${POSTGRES_DB}?schema=public"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-$STORAGE_ACCESS_KEY}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-$STORAGE_SECRET_KEY}"
MINIO_APP_USER="${MINIO_APP_USER:-inmobiliaria-app}"
MINIO_APP_PASSWORD="${MINIO_APP_PASSWORD:-$(openssl rand -hex 24)}"
STORAGE_ACCESS_KEY="$MINIO_APP_USER"
STORAGE_SECRET_KEY="$MINIO_APP_PASSWORD"

temporary="$(mktemp)"
job_file="$(mktemp)"
trap 'rm -f "$temporary" "$job_file"' EXIT
grep -vE '^(DATABASE_URL|DATABASE_MIGRATION_URL|POSTGRES_APP_USER|POSTGRES_APP_PASSWORD|MINIO_ROOT_USER|MINIO_ROOT_PASSWORD|MINIO_APP_USER|MINIO_APP_PASSWORD|STORAGE_ACCESS_KEY|STORAGE_SECRET_KEY)=' "$secret_file" > "$temporary" || true
cat >> "$temporary" <<EOF
DATABASE_URL=$DATABASE_URL
DATABASE_MIGRATION_URL=$DATABASE_MIGRATION_URL
POSTGRES_APP_USER=$POSTGRES_APP_USER
POSTGRES_APP_PASSWORD=$POSTGRES_APP_PASSWORD
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_APP_USER=$MINIO_APP_USER
MINIO_APP_PASSWORD=$MINIO_APP_PASSWORD
STORAGE_ACCESS_KEY=$STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY=$STORAGE_SECRET_KEY
EOF
install -m 600 "$temporary" "$secret_file"

kubectl -n "$namespace" create secret generic asesoria-secrets \
  --from-env-file="$secret_file" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$namespace" create configmap postgres-app-role-sql \
  --from-file=configure-app-role.sql="$repo/docker/postgres/configure-app-role.sql" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$namespace" create configmap minio-app-policy \
  --from-file=app-policy.json="$repo/docker/minio/app-policy.json" \
  --dry-run=client -o yaml | kubectl apply -f -

if [[ "$mode" == --secrets-only ]]; then
  echo 'Secretos separados de DEV preparados.'
  exit 0
fi

bash "$repo/scripts/dev-release-status.sh" || true
role_job="postgres-app-role-$(date +%s)"
cat > "$job_file" <<EOF
apiVersion: batch/v1
kind: Job
metadata: { name: $role_job, namespace: $namespace }
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 180
  ttlSecondsAfterFinished: 86400
  template:
    metadata: { labels: { job-role: db-init } }
    spec:
      restartPolicy: Never
      containers:
        - name: configure-role
          image: postgres:17-alpine
          resources:
            requests: { cpu: 10m, memory: 32Mi }
          command: ["/bin/sh", "-ec"]
          args:
            - |
              database_admin_url="\${DATABASE_MIGRATION_URL%%\?*}"
              psql "\$database_admin_url" --set=ON_ERROR_STOP=1 \\
                --set=database_name="\$POSTGRES_DB" \\
                --set=migrator_user="\$POSTGRES_USER" \\
                --set=app_user="\$POSTGRES_APP_USER" \\
                --set=app_password="\$POSTGRES_APP_PASSWORD" \\
                --file=/security/configure-app-role.sql
              psql "\$database_admin_url" -Atc "SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname='\$POSTGRES_APP_USER'"
          envFrom:
            - secretRef: { name: asesoria-secrets }
          volumeMounts:
            - { name: role-sql, mountPath: /security, readOnly: true }
      volumes:
        - name: role-sql
          configMap: { name: postgres-app-role-sql }
EOF
kubectl apply -f "$job_file"
if ! kubectl -n "$namespace" wait --for=condition=complete "job/$role_job" --timeout=180s; then
  bash "$repo/scripts/dev-release-status.sh" "$role_job" || true
  exit 1
fi
kubectl -n "$namespace" logs "job/$role_job" --tail=20

bash "$repo/scripts/dev-storage-ready.sh"
# The pinned server ships mc. Reuse its ready replica and private connection
# instead of scheduling a second storage pod on the recovering DEV node.
{
  printf '%s\n' "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" "$MINIO_APP_USER" "$MINIO_APP_PASSWORD"
  cat "$repo/docker/minio/app-policy.json"
} | timeout 150 kubectl -n "$namespace" exec -i deployment/minio -c minio -- \
    sh -ec "$(cat "$repo/scripts/configure-dev-storage.sh")"
echo 'Credenciales y privilegios mínimos de DEV configurados.'
