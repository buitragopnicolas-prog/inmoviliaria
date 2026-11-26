export const instruments = [
  {id:'usd', symbol:'COP=X', unit:'COP'},
  {id:'brent', symbol:'BZ=F', unit:'USD/barril'},
  {id:'sp', symbol:'^GSPC', unit:'pts'},
  {id:'cib', symbol:'CIB', unit:'USD'},
  {id:'aval', symbol:'AVAL', unit:'USD'},
] as const;

export type InstrumentId = typeof instruments[number]['id'];
export type MarketQuote = {
  id: InstrumentId;
  value: number;
  change: number | null;
  asOf: string;
  retained: boolean;
};
export type MarketSnapshot = { quotes: Partial<Record<InstrumentId,MarketQuote>> };
export const marketRefreshMs = 120_000;
