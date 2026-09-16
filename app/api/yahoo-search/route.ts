import { isAssetCurrency } from '@/app/lib/currency';

type YahooQuote = {
  symbol?: string;
  longname?: string;
  shortname?: string;
  exchange?: string;
  currency?: string;
  quoteType?: string;
};
type YahooSearchResponse = { quotes?: YahooQuote[] };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return Response.json([], { status: 200 });

  const yahooResponse = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`,
    { headers: { 'User-Agent': 'Personal-Portfolio-Tracker/1.0' } },
  );
  if (!yahooResponse.ok)
    return Response.json({ error: 'Yahoo Finance search is unavailable.' }, { status: 502 });

  const data = (await yahooResponse.json()) as YahooSearchResponse;
  const instruments = (data?.quotes ?? [])
    .flatMap((quote: YahooQuote) => {
      if (
        !quote.symbol ||
        !['EQUITY', 'ETF', 'MUTUALFUND'].includes(quote.quoteType ?? '')
      )
        return [];
      const currency = quote.exchange === 'JKT' ? 'IDR' : quote.currency;
      if (!isAssetCurrency(currency)) return [];
      return [
        {
          symbol: quote.symbol,
          name: quote.longname ?? quote.shortname ?? quote.symbol,
          exchange: quote.exchange ?? 'Market data',
          currency,
        },
      ];
    })
    .slice(0, 8);

  return Response.json(instruments, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
