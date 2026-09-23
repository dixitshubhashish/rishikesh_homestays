// Shared geolocation lookup, backed by our own /api/geo (which reads
// Vercel's free x-vercel-ip-country edge header in production — no external
// API call at all there). country-select.js (phone country auto-detect)
// and currency.js (price conversion) both use this instead of each calling
// a geolocation service independently.
//
// Cached two ways:
//   1. In-memory, for repeat calls within the same page load.
//   2. In localStorage for 24 hours, so a visitor's country is only looked
//      up once a day (not once per page, not even once per browser
//      session) — it isn't going to change page to page or hour to hour.
const STORAGE_KEY = 'rh_geo_country_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cachedCountryPromise = null;

function readStorageCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { country, expiresAt } = JSON.parse(raw);
    if (!country || Date.now() > expiresAt) return null;
    return country;
  } catch {
    return null;
  }
}

function writeStorageCache(country) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ country, expiresAt: Date.now() + CACHE_TTL_MS }));
  } catch {
    // Ignore — privacy mode or storage disabled; falls back to one fetch per page.
  }
}

export function detectCountryCode(timeoutMs = 2500) {
  if (cachedCountryPromise) return cachedCountryPromise;

  const cached = readStorageCache();
  if (cached) {
    cachedCountryPromise = Promise.resolve(cached);
    return cachedCountryPromise;
  }

  cachedCountryPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch('/api/geo', { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) return null;
      const data = await response.json();
      const iso2 = String(data?.country || '').toUpperCase();
      const valid = /^[A-Z]{2}$/.test(iso2) ? iso2 : null;
      if (valid) writeStorageCache(valid);
      return valid;
    } catch {
      return null;
    }
  })();

  return cachedCountryPromise;
}

// Test-only: clears both cache layers so tests exercising multiple mocked
// fetch responses in the same process don't see a stale result.
export function _resetGeoCacheForTests() {
  cachedCountryPromise = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
