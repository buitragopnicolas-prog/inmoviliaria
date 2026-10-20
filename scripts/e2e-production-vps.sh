#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'El E2E de producción requiere el contexto protegido del VPS.' >&2; exit 1; }
release="${1:-}"
[[ "$release" =~ ^[a-f0-9]{40}$ ]] || exit 2
exec 9>/opt/asesoria-inmobiliaria/deploy.lock
flock 9
repo="$(cd "$(dirname "$0")/.." && pwd)"
[[ "$(git -C "$repo" rev-parse HEAD)" == "$release" ]]
export PATH="/opt/asesoria-inmobiliaria/sonar/runtime/bin:$PATH"
node --env-file=/etc/asesoria-inmobiliaria/sonar.env /opt/asesoria-inmobiliaria/sonar/sonar-gate.mjs "$release"
for component in api web; do
  image="$(kubectl -n asesoria-inmobiliaria get deploy "$component" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  [[ "$image" == "asesoria-inmobiliaria-$component:prod-$release" ]] || { echo 'Producción no ejecuta el SHA solicitado.' >&2; exit 1; }
done
umask 077
state=/var/lib/asesoria-inmobiliaria-production
install -d -m 700 "$state/payment-probes"
evidence="$(mktemp "$state/payment-probes/$release-XXXXXXXX.jsonl")"
probe="$repo/scripts/e2e-manual-payments-production.mjs"

# If kubectl/SSH is interrupted, recover only the run recorded by this invocation.
# Recovery never converts a failed probe into a successful deployment.
recover() {
  original_status=$?
  trap - EXIT HUP INT TERM
  run="$(node --input-type=module - "$evidence" <<'NODE'
import fs from 'node:fs';
const events = fs.readFileSync(process.argv[2], 'utf8').split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
const result = events.findLast(event => event.stage === 'result');
if (!result?.report.cleanup) {
  const run = events.find(event => event.stage === 'fixtures_created' || event.stage === 'probe_started')?.run;
  if (/^E2E-PROD-[A-F0-9]{12}$/.test(run ?? '')) console.log(run);
}
NODE
)"
  if [[ -n "$run" ]]; then
    timeout --signal=TERM --kill-after=15 180 kubectl -n asesoria-inmobiliaria exec -i deploy/api -- \
      env E2E_RELEASE_SHA="$release" node --input-type=module - --cleanup "$run" < "$probe" > "$evidence.recovery" || {
      echo "Falló el cierre del E2E sintético; revisar la evidencia privada: $evidence" >&2
      original_status=1
    }
  fi
  exit "$original_status"
}
trap recover EXIT
trap 'exit 143' HUP TERM
trap 'exit 130' INT
echo 'E2E producción: reporte web, PDF privado y aprobación administrativa con datos sintéticos.'
timeout --signal=TERM --kill-after=15 180 kubectl -n asesoria-inmobiliaria exec -i deploy/api -- \
  env E2E_RELEASE_SHA="$release" node --input-type=module < "$probe" > "$evidence"
node --input-type=module - "$evidence" "$release" <<'NODE'
import assert from 'node:assert/strict';
import fs from 'node:fs';
const events = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(line => JSON.parse(line));
const report = events.findLast(event => event.stage === 'result')?.report;
assert.equal(report?.commit, process.argv[3]);
for (const flag of ['passed','flowPassed','cleanup','existingRecordsUnchanged','temporarySessionsRevoked']) assert.equal(report[flag], true, `Falló ${flag}; revisar evidencia privada.`);
console.log(`E2E producción ${report.run}: aprobado; pago de prueba anulado, factura archivada, cuentas desactivadas y auditoría conservada.`);
console.log(`Registros preexistentes sin cambios. Evidencia privada: ${process.argv[2]}`);
NODE
printf '%s\n' "$release" > "$state/verified-sha"
