import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DateTime} from 'luxon';
import {parseQuote,marketSnapshot} from './market-feed';
import {instruments,marketRefreshMs} from './markets';

const seconds=(utc:string)=>Date.parse(utc)/1000;
function chart(symbol:string) {
  return {meta:{symbol,regularMarketPrice:110,regularMarketTime:seconds('2026-11-02T21:00:00Z'),exchangeTimezoneName:'America/New_York'},
    timestamp:['2026-10-29T13:30Z','2026-10-30T13:30Z','2026-11-02T14:30Z'].map(seconds),
    indicators:{quote:[{close:[100,null,110] as (number|null)[]}]}};
}

test('la variación usa el último cierre disponible antes de la sesión',()=>{
  const input=chart('CIB'),quote=parseQuote(instruments[3],input);
  assert.ok(Math.abs(quote.change!-10)<1e-9);
  input.indicators.quote[0].close[0]=null;
  assert.equal(parseQuote(instruments[3],input).change,null);
  assert.throws(()=>parseQuote(instruments[4],input));
});

test('una consulta concurrente por símbolo, caché y fallo parcial', async context=>{
  let clock=Date.now(),failed='',calls=0;
  context.mock.method(Date,'now',()=>clock);
  context.mock.method(globalThis,'fetch',async (url:string)=>{
    calls++;
    const symbol=decodeURIComponent(new URL(url).pathname.split('/').at(-1)!);
    return failed===symbol?new Response(null,{status:503}):Response.json({chart:{result:[chart(symbol)]}});
  });
  const [first]=await Promise.all([marketSnapshot(),marketSnapshot()]);
  assert.equal(Object.keys(first.quotes).length,5);
  await marketSnapshot();
  assert.equal(calls,5);
  failed='AVAL';clock+=marketRefreshMs+1;
  const second=await marketSnapshot();
  assert.equal(calls,10);
  assert.equal(second.quotes.aval?.retained,true);
  assert.equal(second.quotes.aval?.asOf,first.quotes.aval?.asOf);
  assert.equal(second.quotes.sp?.retained,false);
});

test('las cuatro zonas respetan días distintos y cambios estacionales',()=>{
  const hours=(iso:string)=>['Europe/London','America/New_York','Asia/Shanghai','Asia/Dubai'].map(zone=>DateTime.fromISO(iso,{zone}).toFormat('dd HH'));
  assert.deepEqual(hours('2026-07-01T23:30:00Z'),['02 00','01 19','02 07','02 03']);
  assert.deepEqual(hours('2026-12-01T23:30:00Z'),['01 23','01 18','02 07','02 03']);
});
