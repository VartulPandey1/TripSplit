export interface CurrencyConfig {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'INR', symbol: '₹', label: 'INR (₹) - Indian Rupee' },
  { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$) - Australian Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$) - Canadian Dollar' },
  { code: 'AED', symbol: 'AED', label: 'AED (د.إ) - UAE Dirham' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$) - Singapore Dollar' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥) - Japanese Yen' },
  { code: 'THB', symbol: '฿', label: 'THB (฿) - Thai Baht' },
];

export function getCurrencySymbol(code?: string | null): string {
  if (!code) return '₹';
  const found = CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
  return found ? found.symbol : code;
}

const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-US',
  GBP: 'en-GB',
  AUD: 'en-AU',
  CAD: 'en-CA',
  AED: 'en-AE',
  SGD: 'en-SG',
  JPY: 'ja-JP',
  THB: 'en-US',
};

export function formatMoney(amount: number, currencyCode: string = 'INR'): string {
  const code = (currencyCode || 'INR').toUpperCase();
  const symbol = getCurrencySymbol(code);
  const locale = CURRENCY_LOCALES[code] || 'en-US';
  const isZeroDecimal = code === 'JPY';

  const formattedNumber = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  });

  if (amount < -0.001) {
    return `-${symbol}${formattedNumber}`;
  }
  return `${symbol}${formattedNumber}`;
}

// Baseline exchange rates relative to USD (1 USD = X target currency)
export const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 84.5,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.52,
  CAD: 1.38,
  AED: 3.67,
  SGD: 1.34,
  JPY: 153.0,
  THB: 34.5,
};

/**
 * Calculates the exchange rate between any two supported currencies.
 * Returns the multiplier to convert 1 unit of fromCurrency into toCurrency.
 */
export function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  const fromUpper = (fromCurrency || 'INR').toUpperCase();
  const toUpper = (toCurrency || 'INR').toUpperCase();
  if (fromUpper === toUpper) return 1.0;

  const fromRate = USD_EXCHANGE_RATES[fromUpper] || 1.0;
  const toRate = USD_EXCHANGE_RATES[toUpper] || 1.0;

  const rate = toRate / fromRate;
  return Math.round(rate * 10000) / 10000;
}
