#!/usr/bin/env bash
set -euo pipefail

stage="${1:-}"
request="${SSH_ORIGINAL_COMMAND:-}"
sha="${request%% *}"
[[ "$stage" == dev || "$stage" == prod ]] || exit 2
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 2
if [[ "$stage" == prod ]]; then
  [[ "$request" == "$sha production-backup-e2e" ]] || { echo 'Producción requiere respaldo verificado y E2E obligatorios.' >&2; exit 2; }
else
  [[ "$request" == "$sha" ]] || exit 2
fi

# Serialize checkout and deployment across both environments so another SSH
# invocation cannot replace the source tree after its Sonar approval is checked.
exec 8>/run/lock/asesoria-inmobiliaria-checkout.lock
flock 8

# This installed guard is independent of the requested release. Older commits
# cannot bypass Sonar by checking out an earlier version of deploy-vps.sh.
export PATH="/opt/asesoria-inmobiliaria/sonar/runtime/bin:$PATH"
node --env-file=/etc/asesoria-inmobiliaria/sonar.env \
  /opt/asesoria-inmobiliaria/sonar/sonar-gate.mjs "$sha"

checkout=/opt/asesoria-inmobiliaria/cd
if [[ ! -d "$checkout/.git" ]]; then
  git clone --no-checkout https://github.com/buitragopnicolas-prog/inmoviliaria.git "$checkout"
fi
git -C "$checkout" fetch --prune origin main
git -C "$checkout" merge-base --is-ancestor "$sha" origin/main || {
  echo 'Solo se despliegan commits de main.' >&2
  exit 1
}
git -C "$checkout" checkout --detach --force "$sha"
if [[ "$stage" == prod ]]; then
  # Fail before deployment for older releases without the mandatory production probe.
  [[ -f "$checkout/scripts/backup-production.py" && -f "$checkout/scripts/production-release.sh" && -f "$checkout/scripts/e2e-production-vps.sh" && -f "$checkout/scripts/e2e-manual-payments-production.mjs" ]] || {
    echo 'El commit no incluye el respaldo y E2E obligatorios de producción.' >&2
    exit 1
  }
  exec bash "$checkout/scripts/production-release.sh" "$sha"
fi
exec bash "$checkout/scripts/deploy-vps.sh" "$stage" "$sha"
