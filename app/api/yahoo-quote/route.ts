import { isAssetCurrency } from '@/app/lib/currency';

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        currency?: string;
      };
    }>;
  };
};

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get('symbol')?.trim() ?? '';
  if (!/^[A-Za-z0-9.^=-]{1,32}$/.test(symbol))
    return Response.json({ error: 'Invalid symbol.' }, { status: 400 });

  const yahooResponse = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
    { headers: { 'User-Agent': 'Personal-Portfolio-Tracker/1.0' } },
  );
  if (!yahooResponse.ok)
    return Response.json({ error: 'Yahoo Finance quote is unavailable.' }, { status: 502 });

  const data = (await yahooResponse.json()) as YahooChartResponse;
  const meta = data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice ?? meta?.previousClose;
  if (!meta || !price)
    return Response.json({ error: 'No quote was returned.' }, { status: 404 });

  const currency = meta.currency ?? 'USD';
  if (!isAssetCurrency(currency))
    return Response.json({ error: 'This quote uses an unsupported currency.' }, { status: 422 });

  return Response.json(
    { price, currency },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
