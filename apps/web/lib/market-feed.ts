import { instruments, marketRefreshMs, type MarketQuote, type MarketSnapshot } from './markets';

type Chart = {
  meta: {symbol:string; regularMarketPrice:number; regularMarketTime:number; exchangeTimezoneName:string};
  timestamp: number[];
  indicators: {quote:{close:(number|null)[]}[]};
};
type Instrument = typeof instruments[number];

export function parseQuote(instrument:Instrument, chart:Chart):MarketQuote {
  const {meta,timestamp,indicators} = chart;
  if (meta.symbol !== instrument.symbol || !Number.isFinite(meta.regularMarketPrice) ||
      !Number.isFinite(meta.regularMarketTime) || meta.regularMarketTime <= 0) throw new Error('Cotización incompleta');
  const time = new Date(meta.regularMarketTime * 1000);
  const day = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:meta.exchangeTimezoneName});
  const session = day.format(time);
  let previous: number | null = null;
  for (let i=timestamp.length-1; i>=0; i--) {
    const close=indicators.quote[0].close[i];
    if (timestamp[i] < meta.regularMarketTime && day.format(new Date(timestamp[i]*1000)) !== session &&
        typeof close === 'number' && Number.isFinite(close) && close > 0) {
      previous=close;
      break;
    }
  }
  return {id:instrument.id,value:meta.regularMarketPrice,change:previous===null?null:(meta.regularMarketPrice/previous-1)*100,
    asOf:time.toISOString(),retained:false};
}

let cached: MarketSnapshot = {quotes:{}};
let expires = 0;
let pending: Promise<MarketSnapshot> | undefined;

async function refresh():Promise<MarketSnapshot> {
  const quotes: MarketSnapshot['quotes'] = {};
  await Promise.all(instruments.map(async instrument=>{
    try {
      const symbol = encodeURIComponent(instrument.symbol);
      const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+symbol+'?range=5d&interval=1d',
        {cache:'no-store',signal:AbortSignal.timeout(5500)});
      if (!response.ok) throw new Error('Fuente indisponible');
      const body = await response.json();
      quotes[instrument.id] = parseQuote(instrument,body.chart.result[0]);
    } catch {
      const last = cached.quotes[instrument.id];
      if (last) quotes[instrument.id]={...last,retained:true};
    }
  }));
  cached = {quotes};
  expires = Date.now()+marketRefreshMs;
  return cached;
}

export function marketSnapshot():Promise<MarketSnapshot> {
  if(Date.now()<expires)return Promise.resolve(cached);
  pending ??= refresh().finally(()=>{pending=undefined;});
  return pending;
}
