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

// Check-out must be strictly after check-in when both are provided.
export function validateDateRange(checkinValue, checkoutValue) {
  if (!checkinValue && !checkoutValue) {
    return { valid: true };
  }
  if (checkoutValue && !checkinValue) {
    return { valid: false, message: 'Please select a check-in date first.' };
  }
  if (checkinValue && checkoutValue) {
    const checkin = new Date(checkinValue);
    const checkout = new Date(checkoutValue);
    if (Number.isNaN(checkin.getTime()) || Number.isNaN(checkout.getTime())) {
      return { valid: false, message: 'Enter valid dates.' };
    }
    if (checkout <= checkin) {
      return { valid: false, message: 'Check-out date must be after check-in date.' };
    }
  }
  return { valid: true };
}
