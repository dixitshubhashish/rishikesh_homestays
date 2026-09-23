// Best-effort visitor currency conversion for display only — actual
// bookings are always settled in INR directly with the host/WhatsApp, so
// this never replaces the INR price, only adds an approximate equivalent
// next to it for travellers browsing in a non-INR currency.
//
// Rates are rough, static approximations (not live market rates) — good
// enough for "about how much is this", not for anything transactional.
const INR_RATES = {
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AUD: 0.018,
  CAD: 0.0165,
  JPY: 1.8
};

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

let cachedCurrency = null;

export async function detectVisitorCurrency(timeoutMs = 2500) {
  if (cachedCurrency) return cachedCurrency;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    const countryCode = String(data.country_code || "").toUpperCase();
    cachedCurrency = COUNTRY_TO_CURRENCY[countryCode] || null;
    return cachedCurrency;
  } catch {
    return null;
  }
}

// Rounds the converted amount UP to the nearest 5 units of the TARGET
// currency (e.g. $154 -> $155, not rounded in INR first).
export function convertFromINR(amountINR, currencyCode) {
  const rate = INR_RATES[currencyCode];
  if (!rate) return null;
  const converted = amountINR * rate;
  return Math.ceil(converted / 5) * 5;
}

export function formatConverted(amountINR, currencyCode) {
  const rounded = convertFromINR(amountINR, currencyCode);
  if (rounded === null) return null;
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode + " ";
  return `≈ ${symbol}${rounded.toLocaleString()}`;
}

export async function setupCurrencyConversion() {
  const priceEls = document.querySelectorAll("[data-price-inr]");
  if (!priceEls.length) return;

  const currency = await detectVisitorCurrency();
  if (!currency) return;

  priceEls.forEach((el) => {
    const amountINR = Number(el.dataset.priceInr);
    if (!amountINR) return;
    const label = formatConverted(amountINR, currency);
    if (!label) return;
    const span = document.createElement("span");
    span.className = "price-converted";
    span.textContent = label;
    el.appendChild(span);
  });
}
