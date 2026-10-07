// Shared form validation helpers (browser-side).
//
// Phone validation uses libphonenumber-js (window.libphonenumber, loaded as
// a vendor script) for real per-country rules — number length, valid
// leading digits, etc. all come from Google's phone metadata rather than a
// hand-rolled regex, so it works correctly for every country in the
// country-select dropdown, not just India.
export function validatePhone(nationalNumber, countryIso2) {
  const value = String(nationalNumber || '').trim();
  if (!value) return { valid: false, message: 'Phone number is required.' };
  if (!countryIso2) return { valid: false, message: 'Please select a country.' };

  const lib = typeof window !== 'undefined' ? window.libphonenumber : null;

  if (!lib || typeof lib.isValidPhoneNumber !== 'function') {
    // Defensive fallback if the phone number library failed to load.
    const digits = value.replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 15) {
      return { valid: false, message: 'Enter a valid phone number.' };
    }
    return { valid: true, normalized: `+${digits}` };
  }

  if (!lib.isValidPhoneNumber(value, countryIso2)) {
    return { valid: false, message: 'Enter a valid phone number for the selected country.' };
  }

  const parsed = lib.parsePhoneNumberFromString(value, countryIso2);
  return { valid: true, normalized: parsed.number };
}

// Bike/taxi rentals: unlike a stay, a rental can start and end on the same
// day (a one-day scooty, an airport drop), so the end date only has to be on
// or after the start date. Used by rental-form.js and by api/contact.js for
// `source: 'rental_enquiry'`.
export function validateRentalDateRange(startValue, endValue) {
  if (!startValue && !endValue) {
    return { valid: true };
  }
  if (endValue && !startValue) {
    return { valid: false, code: 'start_date_missing', message: 'Please select a start date first.' };
  }
  if (startValue && endValue) {
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { valid: false, code: 'invalid_dates', message: 'Enter valid dates.' };
    }
    if (end < start) {
      return { valid: false, code: 'end_before_start', message: 'End date can\'t be before the start date.' };
    }
  }
  return { valid: true };
}

// Check-out must be strictly after check-in when both are provided.
export function validateDateRange(checkinValue, checkoutValue) {
  if (!checkinValue && !checkoutValue) {
    return { valid: true };
  }
  if (checkoutValue && !checkinValue) {
    return { valid: false, code: 'checkin_missing', message: 'Please select a check-in date first.' };
  }
  if (checkinValue && checkoutValue) {
    const checkin = new Date(checkinValue);
    const checkout = new Date(checkoutValue);
    if (Number.isNaN(checkin.getTime()) || Number.isNaN(checkout.getTime())) {
      return { valid: false, code: 'invalid_dates', message: 'Enter valid dates.' };
    }
    if (checkout <= checkin) {
      return { valid: false, code: 'checkout_not_after_checkin', message: 'Check-out date must be after check-in date.' };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Bug reports (/report-a-bug, source 'bug_report').
//
// One rule set for the browser (bug-report-form.js) and the server (api/contact.js imports this file),
// so both sides agree on what a report is. A report has no phone and no name: the person only needs to
// say what went wrong. The reporter's email is optional and is never written to (docs/ARCHITECTURE.md).
// ---------------------------------------------------------------------------

// What part of the site it is about: [value sent, label shown].
export const BUG_TYPES = [
  ['layout', 'Layout or looks'],
  ['language', 'Translation or language'],
  ['form', 'A form or enquiry'],
  ['stays', 'A stays page'],
  ['search', 'Search'],
  ['map', 'Map'],
  ['speed', 'Speed'],
  ['other', 'Something else']
];

// How bad it is: [value sent, label shown].
export const BUG_SEVERITIES = [
  ['cosmetic', 'Cosmetic (looks off, works fine)'],
  ['minor', 'Small annoyance'],
  ['serious', 'Serious (a feature is broken)'],
  ['blocker', 'Blocks booking or enquiry']
];

// Lengths in characters. The server trims to these as well, so nothing oversized reaches the email.
export const BUG_LIMITS = {
  summary: { min: 5, max: 120 },
  steps: { min: 5, max: 2000 },
  expected: { min: 3, max: 1000 },
  actual: { min: 3, max: 1000 },
  page: { max: 500 },
  device: { max: 300 },
  email: { max: 254 },
  screenshot: { max: 500 }
};

const BUG_TYPE_LABEL = Object.fromEntries(BUG_TYPES);
const BUG_SEVERITY_LABEL = Object.fromEntries(BUG_SEVERITIES);
export const bugTypeLabel = (value) => BUG_TYPE_LABEL[value] || String(value || '');
export const bugSeverityLabel = (value) => BUG_SEVERITY_LABEL[value] || String(value || '');

// Collapses runs of spaces and tabs inside a line, keeps line breaks (steps are often a numbered list),
// trims the ends and caps the length.
function clean(value, max) {
  const text = String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return max ? text.slice(0, max) : text;
}

// A link or a site path: "https://example.com/x" or "/hotels/best-hotels-in-rishikesh". Nothing else
// (no javascript:, data: or mailto:), because the value ends up as a link in the email.
export function isHttpUrlOrPath(value) {
  const text = String(value || '').trim();
  if (!text || /\s/.test(text)) return false;
  if (text.startsWith('/') && !text.startsWith('//')) return true;
  try {
    const url = new URL(text);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

// Plain "name@host.tld": enough to catch typos; the email is only ever used to reply by hand.
export function isPlausibleEmail(value) {
  const text = String(value || '').trim();
  return text.length <= 254 && /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:.]{2,}$/.test(text);
}

// Validates and cleans a bug report. `input` holds summary, page, type, severity, steps, expected, actual,
// device, email, screenshot (all strings). Returns { valid, errors, values }: `errors` maps a field name
// to its message (empty when valid), `values` is the trimmed, length-capped report to send.
export function validateBugReport(input = {}) {
  const L = BUG_LIMITS;
  const values = {
    summary: clean(input.summary, L.summary.max),
    page: clean(input.page, L.page.max),
    type: clean(input.type, 40),
    severity: clean(input.severity, 40),
    steps: clean(input.steps, L.steps.max),
    expected: clean(input.expected, L.expected.max),
    actual: clean(input.actual, L.actual.max),
    device: clean(input.device, L.device.max),
    email: clean(input.email, L.email.max),
    screenshot: clean(input.screenshot, L.screenshot.max)
  };
  const errors = {};

  if (values.summary.length < L.summary.min) {
    errors.summary = `Give the problem a short title (${L.summary.min} to ${L.summary.max} characters).`;
  }
  if (values.page && !isHttpUrlOrPath(values.page)) {
    errors.page = 'Enter a link (https://...) or a page path such as /contact, or leave it empty.';
  }
  if (!(values.type in BUG_TYPE_LABEL)) errors.type = 'Please choose what the problem is about.';
  if (!(values.severity in BUG_SEVERITY_LABEL)) errors.severity = 'Please choose how serious it is.';
  if (values.steps.length < L.steps.min) errors.steps = 'Tell us the steps to see the problem, one per line.';
  if (values.expected.length < L.expected.min) errors.expected = 'Tell us what you expected to happen.';
  if (values.actual.length < L.actual.min) errors.actual = 'Tell us what happened instead.';
  if (values.email && !isPlausibleEmail(values.email)) errors.email = 'Enter a valid email address, or leave it empty.';
  if (values.screenshot && !isHttpUrlOrPath(values.screenshot)) {
    errors.screenshot = 'Enter a link (https://...) to the screenshot, or leave it empty.';
  }

  return { valid: Object.keys(errors).length === 0, errors, values };
}

// The plain-text body of a report, in a fixed order. The browser sends it as `details` and the server
// builds the same text from the fields (it never trusts the browser's copy).
export function buildBugReportDetails(values = {}) {
  const lines = [
    `Summary: ${values.summary || ''}`,
    `Type: ${bugTypeLabel(values.type)}`,
    `Severity: ${bugSeverityLabel(values.severity)}`,
    `Page: ${values.page || 'Not given'}`,
    '',
    'Steps to reproduce:',
    values.steps || '',
    '',
    'Expected:',
    values.expected || '',
    '',
    'Actual:',
    values.actual || '',
    '',
    `Device: ${values.device || 'Not given'}`
  ];
  if (values.screenshot) lines.push(`Screenshot: ${values.screenshot}`);
  if (values.email) lines.push(`Reporter email: ${values.email}`);
  return lines.join('\n');
}
