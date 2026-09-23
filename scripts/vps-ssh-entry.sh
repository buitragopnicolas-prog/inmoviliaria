#!/usr/bin/env bash
set -euo pipefail

stage="${1:-}"
sha="${SSH_ORIGINAL_COMMAND:-}"
[[ "$stage" == dev || "$stage" == prod ]] || exit 2
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 2

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
