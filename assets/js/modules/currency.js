// Best-effort visitor currency conversion for display only — actual
// bookings are always settled in INR directly with the host/WhatsApp, so
// this never replaces the INR price, only adds an approximate equivalent
// next to it for travellers browsing in a non-INR currency.
//
// Rates come from /api/currency-rates (live, refreshed once a day server-side
// and cached client-side the same way) — good enough for "about how much is
// this", not for anything transactional. FALLBACK_RATES is used as the
// default whenever no live rates have been fetched yet (including in unit
// tests, which call convertFromINR/formatConverted synchronously without
// ever fetching), and as the safety net if the live fetch fails.
import { detectCountryCode } from './geo.js';

const FALLBACK_RATES = {
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AUD: 0.018,
  CAD: 0.0165,
  JPY: 1.8
};

const RATES_STORAGE_KEY = 'rh_currency_rates_v1';
const RATES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cachedRatesPromise = null;

function readRatesStorageCache() {
  try {
    const raw = localStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return null;
    const { rates, expiresAt } = JSON.parse(raw);
    if (!rates || Date.now() > expiresAt) return null;
    return rates;
  } catch {
    return null;
  }
}

function writeRatesStorageCache(rates) {
  try {
    localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify({ rates, expiresAt: Date.now() + RATES_CACHE_TTL_MS }));
  } catch {
    // Ignore — privacy mode or storage disabled; falls back to one fetch per page.
  }
}

// Fetches live rates (server-cached daily, then client-cached daily too),
// falling back to the static approximations if anything goes wrong.
export function getRates(timeoutMs = 2500) {
  if (cachedRatesPromise) return cachedRatesPromise;

  const cached = readRatesStorageCache();
  if (cached) {
    cachedRatesPromise = Promise.resolve(cached);
    return cachedRatesPromise;
  }

  cachedRatesPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch('/api/currency-rates', { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) return FALLBACK_RATES;
      const data = await response.json();
      if (!data?.rates) return FALLBACK_RATES;
      writeRatesStorageCache(data.rates);
      return data.rates;
    } catch {
      return FALLBACK_RATES;
    }
  })();

  return cachedRatesPromise;
}

// Test-only: mirrors geo.js's reset hook.
export function _resetRatesCacheForTests() {
  cachedRatesPromise = null;
  try {
    localStorage.removeItem(RATES_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥"
};

// Only the major countries for each currency — anyone else (including
// India itself) just sees the INR price with no added conversion.
const COUNTRY_TO_CURRENCY = {
  US: "USD",
  GB: "GBP",
  AU: "AUD",
  CA: "CAD",
  JP: "JPY",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", IE: "EUR",
  PT: "EUR", AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR"
};

export async function detectVisitorCurrency(timeoutMs = 2500) {
  const countryCode = await detectCountryCode(timeoutMs);
  return countryCode ? (COUNTRY_TO_CURRENCY[countryCode] || null) : null;
}

// Rounds the converted amount UP to the nearest 5 units of the TARGET
// currency (e.g. $154 -> $155, not rounded in INR first). `rates` defaults
// to the static fallback table so this stays a pure, synchronous function
// for callers (including tests) that don't need live rates.
export function convertFromINR(amountINR, currencyCode, rates = FALLBACK_RATES) {
  const rate = rates[currencyCode];
  if (!rate) return null;
  const converted = amountINR * rate;
  return Math.ceil(converted / 5) * 5;
}

export function formatConverted(amountINR, currencyCode, rates = FALLBACK_RATES) {
  const rounded = convertFromINR(amountINR, currencyCode, rates);
  if (rounded === null) return null;
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode + " ";
  return `≈ ${symbol}${rounded.toLocaleString()}`;
}

export async function setupCurrencyConversion() {
  const priceEls = document.querySelectorAll("[data-price-inr]");
  if (!priceEls.length) return;

  const [currency, rates] = await Promise.all([detectVisitorCurrency(), getRates()]);
  if (!currency) return;

  priceEls.forEach((el) => {
    const amountINR = Number(el.dataset.priceInr);
    if (!amountINR) return;
    const label = formatConverted(amountINR, currency, rates);
    if (!label) return;
    const span = document.createElement("span");
    span.className = "price-converted";
    span.textContent = label;
    el.appendChild(span);
  });
}
