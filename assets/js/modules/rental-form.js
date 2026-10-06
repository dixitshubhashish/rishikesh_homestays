// Bike & taxi rental enquiry form (/bike-and-taxi-rental-in-rishikesh).
//
// Same building blocks as the main contact form: country-code select +
// libphonenumber validation (phone normalized to E.164 before sending),
// flatpickr start/end dates, the shared busy-state button helper, and a
// device-aware WhatsApp link. Submits to /api/contact with
// `source: SOURCES.rental`; the API only requires name/phone/details, so
// service, dates, pickup point, people and the guest's own notes are all
// folded into `details` as well as sent as their own fields, so nothing is
// lost whatever the API stores.
import { validatePhone, validateRentalDateRange } from './validators.js';
import { setupCountryPhoneField } from './country-select.js';
import { buildWhatsAppLink } from './whatsapp-link.js';
import { setButtonLoading, clearButtonLoading } from './button-loading.js';
import { postEnquiry, SOURCES } from './enquiry.js';

const WHATSAPP_PHONE = '918050091290';

// Value → label for the "What do you need?" select. `needsNotes` marks the
// car options, where we can't quote without a route/car type/luggage.
export const RENTAL_SERVICES = {
  bike: { label: 'Bike / Scooty', needsNotes: false },
  taxi_local: { label: 'Taxi – local', needsNotes: true },
  taxi_pickup: { label: 'Taxi – airport/railway pickup', needsNotes: true },
  taxi_outstation: { label: 'Taxi – outstation', needsNotes: true },
  self_drive: { label: 'Self-drive car', needsNotes: true }
};

export function serviceLabel(value) {
  return RENTAL_SERVICES[value]?.label || '';
}

export function needsNotes(value) {
  return Boolean(RENTAL_SERVICES[value]?.needsNotes);
}

// "Bike", "Car" or "Taxi" for the page the guest is on; the combined page keeps "Bike & Taxi".
function rentalTitle(service, city) {
  if (!city) return 'Bike & Taxi';
  if (service === 'bike') return 'Bike';
  if (service === 'self_drive') return 'Car';
  if (String(service || '').startsWith('taxi')) return 'Taxi';
  return 'Bike & Taxi';
}

function dateLine(data) {
  if (data.start_date && data.end_date) {
    return data.start_date === data.end_date ? data.start_date : `${data.start_date} to ${data.end_date}`;
  }
  return data.start_date || 'Not decided yet';
}

// The `details` text the API requires (and stores as the enquiry message).
export function buildRentalDetails(data) {
  const lines = [
    // the city pages (bike-rental-in-haridwar...) send their city; the combined Rishikesh page sends none
    ...(data.city ? [`City: ${data.city}`] : []),
    `Service: ${serviceLabel(data.service) || 'Not specified'}`,
    `Dates: ${dateLine(data)}`,
    `Pickup point: ${String(data.pickup_point || '').trim() || 'Not specified'}`,
    `People: ${String(data.people || '').trim() || 'Not specified'}`
  ];
  const notes = String(data.description || '').trim();
  lines.push('', notes ? `Notes: ${notes}` : 'Notes: none');
  return lines.join('\n');
}

// Plain-text WhatsApp message (no emoji/unicode bullets, same reason as the
// other forms: some WhatsApp clients render those as broken "tofu").
export function buildRentalWhatsAppMessage(data) {
  let msg = `*${data.city || 'Rishikesh'} ${rentalTitle(data.service, data.city)} Rental Enquiry*\n\n`;
  if (data.name) msg += `- Name: ${data.name}\n`;
  if (data.phone) msg += `- Phone: ${data.phone}\n`;
  if (data.email) msg += `- Email: ${data.email}\n`;
  msg += `- Need: ${serviceLabel(data.service) || 'Not sure yet'}\n`;
  msg += `- Dates: ${dateLine(data)}\n`;
  if (data.pickup_point) msg += `- Pickup point: ${data.pickup_point}\n`;
  if (data.people) msg += `- People: ${data.people}\n`;
  const notes = String(data.description || '').trim();
  if (notes) msg += `\n*Details:*\n${notes}\n`;
  msg += `\n---\n_Sent from Rishikesh Homestays - ${rentalTitle(data.service, data.city)} Rental_`;
  return msg;
}

// Builds the JSON body POSTed to /api/contact. `data.phone` must already be
// the normalized E.164 number.
export function buildRentalPayload(data) {
  const people = parseInt(data.people, 10);
  return {
    name: String(data.name || '').trim(),
    phone: data.phone,
    email: String(data.email || '').trim(),
    service: serviceLabel(data.service),
    service_key: data.service || '',
    check_in: data.start_date || '',
    check_out: data.end_date || '',
    pickup_point: String(data.pickup_point || '').trim(),
    people: Number.isFinite(people) && people > 0 ? people : '',
    description: String(data.description || '').trim(),
    details: buildRentalDetails(data),
    source: 'rental_enquiry'
  };
}

let startPicker = null;
let endPicker = null;

// Start/end calendars: the end date can be the same day as the start (a
// one-day scooty) but never before it.
export function setupRentalDatePickers() {
  if (typeof window.flatpickr !== 'function') return;
  const startInput = document.getElementById('rental_start');
  const endInput = document.getElementById('rental_end');
  const datesError = document.getElementById('rental-dates-error');
  if (!startInput || !endInput) return;

  const base = { dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y', minDate: 'today' };
  endPicker = window.flatpickr(endInput, {
    ...base,
    onChange: () => { if (datesError) datesError.hidden = true; }
  });
  startPicker = window.flatpickr(startInput, {
    ...base,
    onChange: (selectedDates) => {
      if (datesError) datesError.hidden = true;
      const start = selectedDates[0];
      if (!start) return;
      endPicker.set('minDate', start);
      const end = endPicker.selectedDates[0];
      if (end && end < start) endPicker.clear();
    }
  });
}

function readForm(form) {
  return Object.fromEntries(new FormData(form));
}

export function setupRentalForm({ redirect = (url) => window.location.assign(url), autoDetectCountry = true } = {}) {
  const form = document.querySelector('#rentalForm');
  if (!form) return;

  const btn = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-form-status]');
  const phoneInput = form.querySelector('#rental_phone');
  const countrySelect = form.querySelector('#rental_country');
  const phoneError = document.getElementById('rental-phone-error');
  const datesError = document.getElementById('rental-dates-error');
  const serviceSelect = form.querySelector('#rental_service');
  const notes = form.querySelector('#rental_description');
  const notesHint = document.getElementById('rental-description-hint');
  const notesError = document.getElementById('rental-description-error');
  const waButton = document.querySelector('[data-rental-whatsapp]');

  setupCountryPhoneField(countrySelect, { autoDetect: autoDetectCountry });

  // The notes box is only required for the car options.
  const syncNotesRequirement = () => {
    const required = needsNotes(serviceSelect?.value);
    if (notes) notes.required = required;
    if (notesHint) notesHint.textContent = required ? '(required for cars & taxis)' : '(optional)';
  };
  serviceSelect?.addEventListener('change', syncNotesRequirement);
  syncNotesRequirement();

  phoneInput?.addEventListener('input', () => {
    if (phoneError) phoneError.hidden = true;
    phoneInput.classList.remove('field-invalid');
  });
  notes?.addEventListener('input', () => {
    if (notesError) notesError.hidden = true;
    notes.classList.remove('field-invalid');
  });

  // WhatsApp shortcut: sends whatever has been filled in so far, no
  // validation (WhatsApp itself tells us who they are).
  waButton?.addEventListener('click', () => {
    const data = readForm(form);
    const phoneResult = validatePhone(data.phone, countrySelect?.value);
    if (phoneResult.valid) data.phone = phoneResult.normalized;
    window.open(buildWhatsAppLink(WHATSAPP_PHONE, buildRentalWhatsAppMessage(data)), '_blank', 'noopener,noreferrer');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = readForm(form);

    // Name: checked here too, not only by the browser's `required`.
    if (!String(data.name || '').trim()) {
      const nameInput = form.querySelector('[name="name"]');
      if (status) status.textContent = 'Please tell us your name.';
      nameInput?.classList.add('field-invalid');
      nameInput?.focus();
      return;
    }

    const phoneResult = validatePhone(data.phone, countrySelect?.value);
    if (!phoneResult.valid) {
      if (phoneError) {
        phoneError.textContent = phoneResult.message;
        phoneError.hidden = false;
      }
      phoneInput?.classList.add('field-invalid');
      phoneInput?.focus();
      return;
    }
    data.phone = phoneResult.normalized;

    const dateResult = validateRentalDateRange(data.start_date, data.end_date);
    if (!dateResult.valid) {
      if (datesError) {
        datesError.textContent = dateResult.message;
        datesError.hidden = false;
      }
      return;
    }

    if (needsNotes(data.service) && !String(data.description || '').trim()) {
      if (notesError) {
        notesError.textContent = 'Tell us the route, days and car type so we can quote.';
        notesError.hidden = false;
      }
      notes?.classList.add('field-invalid');
      notes?.focus();
      return;
    }

    setButtonLoading(btn, 'Sending...');
    if (status) status.textContent = '';

    try {
      const result = await postEnquiry(buildRentalPayload(data));
      if (result.success) {
        redirect('/thanks');
        return;
      }
      if (status) {
        status.textContent = result.message || 'Unable to send your enquiry right now.';
        status.classList.add('is-err'); status.classList.remove('is-ok');
      }
    } catch {
      if (status) {
        status.textContent = 'Unable to send your enquiry right now. Please WhatsApp or call us directly.';
        status.classList.add('is-err'); status.classList.remove('is-ok');
      }
    }
    clearButtonLoading(btn);
  });
}
