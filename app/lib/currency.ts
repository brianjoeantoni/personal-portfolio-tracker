export const currencies = [
  {
    code: 'IDR',
    label: 'Indonesian rupiah',
    locale: 'id-ID',
    decimals: 0,
    supportsAssets: true,
    supportsReporting: true,
  },
  {
    code: 'USD',
    label: 'US dollar',
    locale: 'en-US',
    decimals: 2,
    supportsAssets: true,
    supportsReporting: true,
  },
] as const;

export type Currency = (typeof currencies)[number]['code'];
export type FxRates = Partial<Record<Currency, number>>;

/**
 * Values are stored and fetched relative to IDR. This keeps calculations
 * consistent even when the user selects another reporting currency.
 */
export const baseCurrency: Currency = 'IDR';

export const currencyByCode = Object.fromEntries(
  currencies.map((currency) => [currency.code, currency]),
) as Record<Currency, (typeof currencies)[number]>;

export const assetCurrencies = currencies.filter(
  (currency) => currency.supportsAssets,
);
export const reportingCurrencies = currencies.filter(
  (currency) => currency.supportsReporting,
);
export const assetCurrencyCodes = assetCurrencies.map(
  (currency) => currency.code,
);
export const defaultAssetCurrency = baseCurrency;
export const defaultReportingCurrency =
  reportingCurrencies.find((currency) => currency.code === baseCurrency)
    ?.code ??
  reportingCurrencies[0]?.code ??
  baseCurrency;

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && value in currencyByCode;
}

export function isAssetCurrency(value: unknown): value is Currency {
  return isCurrency(value) && currencyByCode[value].supportsAssets;
}

export function isReportingCurrency(value: unknown): value is Currency {
  return isCurrency(value) && currencyByCode[value].supportsReporting;
}

export function formatCurrency(value: number, currency: Currency) {
  const config = currencyByCode[currency];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: config.decimals,
  }).format(value || 0);
}

export function idrRateFor(currency: Currency, fxRates: FxRates) {
  return currency === baseCurrency ? 1 : fxRates[currency];
}

export function convertToIdr(
  value: number,
  currency: Currency,
  fxRates: FxRates,
) {
  const rate = idrRateFor(currency, fxRates);
  return rate ? value * rate : undefined;
}

export function convertFromIdr(
  value: number,
  currency: Currency,
  fxRates: FxRates,
) {
  const rate = idrRateFor(currency, fxRates);
  return rate ? value / rate : undefined;
}
