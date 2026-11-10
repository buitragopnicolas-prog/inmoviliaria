#!/bin/sh
set -eu
umask 077
export ODOO_RC
ODOO_RC="$(mktemp)"
cat > "$ODOO_RC" <<EOF
[options]
data_dir = /var/lib/odoo
http_interface = ${ODOO_HTTP_INTERFACE:-0.0.0.0}
admin_passwd = ${ODOO_MASTER_PASSWORD:?}
db_host = ${ODOO_DB_HOST:?}
db_port = 5432
db_user = odoo
db_password = ${ODOO_DB_PASSWORD:?}
dbfilter = ^jb_odoo$
EOF
exec /entrypoint.sh odoo
