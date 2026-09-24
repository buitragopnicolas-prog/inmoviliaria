import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const formatModule = new URL('../apps/web/lib/format.ts', import.meta.url).href;

function renderDates(timeZone) {
  // Procesos separados reproducen servidor UTC y navegador en Colombia.
  const source = `
    import { fecha, fechaCalendario } from ${JSON.stringify(formatModule)};
    console.log(JSON.stringify({
      dueDate: fechaCalendario('2026-01-01T00:00:00.000Z'),
      period: fechaCalendario('2026-09-01T00:00:00.000Z'),
      leapDay: fechaCalendario('2024-02-29T00:00:00.000Z'),
      dateOnly: fechaCalendario('2026-09-24'),
      midnightPayment: fecha('2026-01-01T00:30:00.000Z'),
      daytimePayment: fecha('2026-09-24T15:30:00.000Z')
    }));
  `;
  return JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', source], {
    env: { ...process.env, TZ: timeZone },
    encoding: 'utf8',
  }));
}

for (const timeZone of ['UTC', 'America/Bogota']) {
  test(`fechas civiles y movimientos mantienen su día correcto con TZ=${timeZone}`, () => {
    assert.deepEqual(renderDates(timeZone), {
      dueDate: '1/01/2026',
      period: '1/09/2026',
      leapDay: '29/02/2024',
      dateOnly: '24/09/2026',
      midnightPayment: '31/12/2025',
      daytimePayment: '24/09/2026',
    });
  });
}
