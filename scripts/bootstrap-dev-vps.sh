#!/usr/bin/env bash
set -euo pipefail

# Ejecutar únicamente en el VPS. Los secretos de desarrollo nunca se copian de producción.
namespace=asesoria-inmobiliaria-dev
secret_file=/root/asesoria-inmobiliaria-dev-secrets.env

install -d -m 700 /var/lib/asesoria-inmobiliaria-dev/postgres
install -d -m 700 /var/lib/asesoria-inmobiliaria-dev/minio
kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -

if [[ ! -f "$secret_file" ]]; then
  umask 077
  db_password="$(openssl rand -hex 24)"
  cat > "$secret_file" <<EOF
POSTGRES_DB=inmobiliaria_dev
POSTGRES_USER=inmobiliaria_dev
POSTGRES_PASSWORD=$db_password
DATABASE_URL=postgresql://inmobiliaria_dev:$db_password@postgres-service:5432/inmobiliaria_dev?schema=public
JWT_SECRET=$(openssl rand -hex 48)
STORAGE_ACCESS_KEY=devadmin
STORAGE_SECRET_KEY=$(openssl rand -hex 32)
ADMIN_INITIAL_EMAIL=admin-dev@asesoriainmobiliariajb.com
ADMIN_INITIAL_PASSWORD=$(openssl rand -hex 20)
CUSTOMER_INITIAL_EMAIL=cliente-dev@asesoriainmobiliariajb.com
CUSTOMER_INITIAL_PASSWORD=$(openssl rand -hex 20)
N8N_PAYMENTS_API_KEY=$(openssl rand -hex 32)
EOF
fi

chmod 600 "$secret_file"
bash "$(cd "$(dirname "$0")" && pwd)/prepare-dev-security.sh" --secrets-only
echo "Namespace y secretos de dev listos; archivo privado: $secret_file"
