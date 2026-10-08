// Country dial-code directory + IP-based country auto-detect.
// Country list and calling codes come straight from libphonenumber-js's
// metadata (window.libphonenumber, loaded as a vendor script) rather than a
// hand-maintained list, so it stays accurate for all ~245 countries.
import { detectCountryCode } from './geo.js';

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

// Windows has no flag emoji (it draws the two letters, so "🇮🇳" shows as "IN"). Where a canvas test finds the flag is not
// drawn in colour, the country selects get the class rh-flag-select, which puts the self-hosted Twemoji Country Flags font
// (assets/vendor/flag-font/, styles.css) in front of their text; it only covers the flag code points. Elsewhere nothing loads.
let flagsDrawn = null;
function flagsSupported() {
  if (flagsDrawn !== null) return flagsDrawn;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.textBaseline = 'top';
    ctx.font = '20px sans-serif';
    ctx.fillText(regionToFlagEmoji('IN'), 0, 0);
    const px = ctx.getImageData(0, 0, 24, 24).data;
    let colour = false;
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 40 && (Math.abs(px[i] - px[i + 1]) > 30 || Math.abs(px[i + 1] - px[i + 2]) > 30)) { colour = true; break; }
    flagsDrawn = colour;
  } catch { flagsDrawn = true; } // cannot test: leave the browser's own flags
  return flagsDrawn;
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
  if (!flagsSupported()) selectEl.classList.add('rh-flag-select');
  return countries;
}

// Detects the visitor's country from their IP address via a free geo-IP
// lookup, with a short timeout and a hard fallback to India so the form
// never blocks on a slow/blocked network call.
export async function detectCountryByIP(timeoutMs = 2500) {
  const iso2 = await detectCountryCode(timeoutMs);
  return iso2 || FALLBACK_COUNTRY;
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
