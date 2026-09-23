// Server-side geolocation. On Vercel, every request already carries an
// `x-vercel-ip-country` header from the edge network — reading it is a
// free, instant header lookup with zero added latency, unlike the
// client-side third-party call this replaces (~700-1300ms per visitor,
// previously paid twice per page load before that got consolidated).
// Local dev has no such header, so it falls back to ipwho.is — free with no
// account, API key, or pricing tier at all (unlike ipapi.co, which rate
// -limits free usage toward a paid plan) — keyed off the request's own IP,
// cached for 24h (the dev machine's IP/country doesn't change page to page,
// or even day to day, in practice — no need to hit it more than once a day
// even across many dev-server restarts within that window, though the
// cache itself is only in-memory and resets when the process restarts).
const DEV_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let devCache = null; // { country, expiresAt }

async function devFallbackCountry() {
  if (devCache && Date.now() < devCache.expiresAt) return devCache.country;

  let country = null;
  try {
    const response = await fetch('https://ipwho.is/');
    if (response.ok) {
      const data = await response.json();
      const iso2 = String(data?.country_code || '').toUpperCase();
      country = data?.success !== false && /^[A-Z]{2}$/.test(iso2) ? iso2 : null;
    }
  } catch {
    country = null;
  }

  // Only cache a successful lookup. A failure (rate-limited, network blip)
  // should be retried on the next request, not frozen as "no country" for
  // a full day — that would silently disable currency conversion in local
  // dev for 24h over one transient error.
  if (country) devCache = { country, expiresAt: Date.now() + DEV_CACHE_TTL_MS };
  return country;
}

export default async function handler(req, res) {
  const vercelCountry = req.headers['x-vercel-ip-country'];
  if (vercelCountry) {
    return res.json({ country: vercelCountry.toUpperCase() });
  }

  const country = await devFallbackCountry();
  return res.json({ country });
}
