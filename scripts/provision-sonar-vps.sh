#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'Requiere root.' >&2; exit 1; }
source_dir="$(cd "$(dirname "$0")/.." && pwd)"
destination=/opt/asesoria-inmobiliaria/sonar
install -d -m 700 "$destination" /etc/asesoria-inmobiliaria
install -m 600 "$source_dir/docker/sonar-vps.compose.yml" "$destination/compose.yml"
install -m 644 "$source_dir/docker/sonar-vps.nginx.conf" /etc/nginx/snippets/inmobiliaria-sonar.conf
install -m 644 "$source_dir/scripts/sonar-gate.mjs" "$destination/sonar-gate.mjs"
if [[ ! -f "$destination/database.env" ]]; then
  umask 077
  printf 'SONAR_DB_PASSWORD=%s\n' "$(openssl rand -hex 32)" > "$destination/database.env"
fi
if [[ ! -x "$destination/runtime/bin/node" ]]; then
  runtime_version=v24.19.0
  archive="node-$runtime_version-linux-x64.tar.xz"
  [[ "$(uname -m)" == x86_64 ]] || { echo 'Runtime requiere x86_64.' >&2; exit 1; }
  temporary="$(mktemp -d)"
  trap 'rm -rf "$temporary"' EXIT
  curl -fsS "https://nodejs.org/dist/$runtime_version/SHASUMS256.txt" -o "$temporary/checksums"
  curl -fsS "https://nodejs.org/dist/$runtime_version/$archive" -o "$temporary/$archive"
  (cd "$temporary"; grep " $archive$" checksums | sha256sum --check -)
  install -d -m 755 "$destination/runtime"
  tar -xJf "$temporary/$archive" -C "$destination/runtime" --strip-components=1
fi
[[ "$(sysctl -n vm.max_map_count)" -ge 524288 ]] || { echo 'vm.max_map_count insuficiente.' >&2; exit 1; }
docker compose --env-file "$destination/database.env" -f "$destination/compose.yml" up -d
nginx_file=/etc/nginx/sites-available/dev.asesoriainmobiliariajb.com
if ! grep -q 'include /etc/nginx/snippets/inmobiliaria-sonar.conf;' "$nginx_file"; then
  cp -p "$nginx_file" "$destination/nginx-before-sonar.conf"
  python3 - "$nginx_file" <<'PY'
import pathlib, sys
file = pathlib.Path(sys.argv[1])
text = file.read_text()
anchor = '    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;'
if text.count(anchor) != 1:
    raise SystemExit('No se encontró un único bloque HTTPS esperado.')
file.write_text(text.replace(anchor, anchor + '\n    include /etc/nginx/snippets/inmobiliaria-sonar.conf;'))
PY
  if ! nginx -t; then
    cp -p "$destination/nginx-before-sonar.conf" "$nginx_file"
    exit 1
  fi
  systemctl reload nginx
fi
echo 'Infraestructura Sonar instalada; inicialice el proyecto antes de habilitar despliegues.'
