#!/usr/bin/env bash
set -euo pipefail

stage="${1:-}"
sha="${SSH_ORIGINAL_COMMAND:-}"
[[ "$stage" == dev || "$stage" == prod ]] || exit 2
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 2

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
exec bash "$checkout/scripts/deploy-vps.sh" "$stage" "$sha"
