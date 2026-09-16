export const reportingCurrencies = [
  { code: 'IDR', label: 'Indonesian rupiah', locale: 'id-ID', decimals: 0 },
  { code: 'USD', label: 'US dollar', locale: 'en-US', decimals: 2 },
] as const;

export type Currency = (typeof reportingCurrencies)[number]['code'];

export const currencyByCode = Object.fromEntries(
  reportingCurrencies.map((currency) => [currency.code, currency]),
) as Record<Currency, (typeof reportingCurrencies)[number]>;

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && value in currencyByCode;
}

export function formatCurrency(value: number, currency: Currency) {
  const config = currencyByCode[currency];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: config.decimals,
  }).format(value || 0);
}

export function convertFromIdr(
  value: number,
  currency: Currency,
  idrPerCurrency: Partial<Record<Currency, number>>,
) {
  if (currency === 'IDR') return value;
  const rate = idrPerCurrency[currency];
  return rate ? value / rate : undefined;
}

export function reportingCurrencyLabel(currency: Currency) {
  return currencyByCode[currency].label;
}
