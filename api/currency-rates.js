// Server-side live exchange rates, refreshed once a day. Source is
// fawazahmed0/currency-api — a fully open-source (MIT), GitHub-hosted
// dataset served as static JSON via the jsDelivr CDN: no API key, no
// account, no pricing tier, nothing to sign up for. It's itself only
// updated once every 24h, so caching here just avoids re-fetching a rate
// that hasn't changed. Falls back to the same static approximations used
// site-wide if the fetch ever fails — this is a "roughly how much is this"
// display, never used for an actual transaction.
// https://github.com/fawazahmed0/currency-api
const FALLBACK_RATES = {
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AUD: 0.018,
  CAD: 0.0165,
  JPY: 1.8
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache = null; // { rates, expiresAt }

async function fetchLiveRates() {
  if (cache && Date.now() < cache.expiresAt) return cache.rates;

  let rates = null;
  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json');
    if (response.ok) {
      const data = await response.json();
      if (data?.inr) {
        rates = {};
        for (const code of Object.keys(FALLBACK_RATES)) {
          const value = data.inr[code.toLowerCase()];
          rates[code] = typeof value === 'number' ? value : FALLBACK_RATES[code];
        }
      }
    }
  } catch {
    rates = null;
  }

  // Only cache a successful fetch — a transient failure should be retried
  // on the next request, not frozen as the static fallback for 24h.
  if (rates) cache = { rates, expiresAt: Date.now() + CACHE_TTL_MS };
  return rates || FALLBACK_RATES;
}

export default async function handler(req, res) {
  const rates = await fetchLiveRates();
  return res.json({ rates });
}
