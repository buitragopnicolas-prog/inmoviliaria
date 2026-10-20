#!/usr/bin/env bash
set -euo pipefail
release="${1:-}"
[[ "$release" =~ ^[a-f0-9]{40}$ ]] || exit 2
repo="$(cd "$(dirname "$0")/.." && pwd)"
# This command is run under the restricted SSH checkout lock. Every invocation
# creates a new receipt; no previous successful backup can hide a current failure.
receipt="$(python3 "$repo/scripts/backup-production.py" create "$release")"
INMO_PRODUCTION_BACKUP_RECEIPT="$receipt" bash "$repo/scripts/deploy-vps.sh" prod "$release"
exec bash "$repo/scripts/e2e-production-vps.sh" "$release"
