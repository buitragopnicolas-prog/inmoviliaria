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
kubectl -n "$namespace" wait --for=condition=complete "job/$role_job" --timeout=180s
kubectl -n "$namespace" logs "job/$role_job" --tail=20

policy_job="minio-app-policy-$(date +%s)"
cat > "$job_file" <<EOF
apiVersion: batch/v1
kind: Job
metadata: { name: $policy_job, namespace: $namespace }
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 180
  ttlSecondsAfterFinished: 86400
  template:
    metadata: { labels: { job-role: minio-init } }
    spec:
      restartPolicy: Never
      containers:
        - name: configure-policy
          image: quay.io/minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727
          command: ["/bin/sh", "-ec"]
          args:
            - |
              until mc alias set root http://minio-service:9000 "\$MINIO_ROOT_USER" "\$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do sleep 2; done
              mc mb --ignore-existing root/inmobiliaria-assets
              mc anonymous set none root/inmobiliaria-assets
              mc admin user add root "\$MINIO_APP_USER" "\$MINIO_APP_PASSWORD"
              mc admin policy create root inmobiliaria-app-policy /security/app-policy.json
              mc admin policy attach root inmobiliaria-app-policy --user "\$MINIO_APP_USER"
              mc alias set app http://minio-service:9000 "\$MINIO_APP_USER" "\$MINIO_APP_PASSWORD" >/dev/null
              printf 'dev-security-probe' | mc pipe app/inmobiliaria-assets/security/dev-probe.txt >/dev/null
              test "\$(mc cat app/inmobiliaria-assets/security/dev-probe.txt)" = dev-security-probe
              if mc admin info app >/dev/null 2>&1; then echo 'La cuenta runtime obtuvo privilegios administrativos.' >&2; exit 1; fi
              mc rm app/inmobiliaria-assets/security/dev-probe.txt >/dev/null
          envFrom:
            - secretRef: { name: asesoria-secrets }
          volumeMounts:
            - { name: app-policy, mountPath: /security, readOnly: true }
      volumes:
        - name: app-policy
          configMap: { name: minio-app-policy }
EOF
kubectl apply -f "$job_file"
kubectl -n "$namespace" wait --for=condition=complete "job/$policy_job" --timeout=180s
kubectl -n "$namespace" logs "job/$policy_job" --tail=20
echo 'Credenciales y privilegios mínimos de DEV configurados.'
