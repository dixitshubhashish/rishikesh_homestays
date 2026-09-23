// Country dial-code directory + IP-based country auto-detect.
// Country list and calling codes come straight from libphonenumber-js's
// metadata (window.libphonenumber, loaded as a vendor script) rather than a
// hand-maintained list, so it stays accurate for all ~245 countries.

const FALLBACK_COUNTRY = 'IN';

function regionToFlagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  const codePoints = [...iso2.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

function regionDisplayName(iso2) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso2) || iso2;
  } catch {
    return iso2;
  }
}

let cachedCountryList = null;

// Returns [{ iso2, name, dialCode, flag }], sorted by country name.
export function getCountryList() {
  if (cachedCountryList) return cachedCountryList;
  const lib = window.libphonenumber;
  if (!lib || typeof lib.getCountries !== 'function') return [];

  cachedCountryList = lib.getCountries()
    .map((iso2) => ({
      iso2,
      name: regionDisplayName(iso2),
      dialCode: lib.getCountryCallingCode(iso2),
      flag: regionToFlagEmoji(iso2)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return cachedCountryList;
}

// Populates a <select> with one <option> per country (flag + name + dial
// code), defaulting to India, and returns the list used.
export function populateCountrySelect(selectEl, defaultIso2 = FALLBACK_COUNTRY) {
  const countries = getCountryList();
  if (!countries.length || !selectEl) return countries;

  selectEl.innerHTML = countries
    .map((c) => `<option value="${c.iso2}" data-dial="${c.dialCode}" title="${c.name} (+${c.dialCode})">${c.flag} ${c.iso2} +${c.dialCode}</option>`)
    .join('');

  selectEl.value = countries.some((c) => c.iso2 === defaultIso2) ? defaultIso2 : FALLBACK_COUNTRY;
  return countries;
}

// Detects the visitor's country from their IP address via a free geo-IP
// lookup, with a short timeout and a hard fallback to India so the form
// never blocks on a slow/blocked network call.
export async function detectCountryByIP(timeoutMs = 2500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return FALLBACK_COUNTRY;
    const data = await response.json();
    const iso2 = String(data?.country_code || '').toUpperCase();
    return /^[A-Z]{2}$/.test(iso2) ? iso2 : FALLBACK_COUNTRY;
  } catch {
    return FALLBACK_COUNTRY;
  }
}

// Wires a country <select> + national-number <input> pair: populates the
// dropdown, auto-detects the visitor's country by IP, and keeps a
// data-dial-code attribute on the select in sync for easy reading elsewhere.
export async function setupCountryPhoneField(selectEl, { autoDetect = true } = {}) {
  if (!selectEl) return;
  populateCountrySelect(selectEl, FALLBACK_COUNTRY);

  if (autoDetect) {
    const detected = await detectCountryByIP();
    if (getCountryList().some((c) => c.iso2 === detected)) {
      selectEl.value = detected;
    }
  }
}
