import { validatePhone, validateDateRange } from './validators.js';
import { setupCountryPhoneField } from './country-select.js';
import { buildWhatsAppLink } from './whatsapp-link.js';

const WHATSAPP_PHONE = '919027212484';

// Formats the same inquiry data as a plain-text WhatsApp message, matching
// the WhatsApp widget's format (no emoji/unicode bullets — some WhatsApp
// clients render those as a broken "tofu" character).
function buildShortlistMessage(data) {
  const adults = data.adults || '1';
  const children = data.children || '0';
  const petCount = data.pet_count || '0';

  let msg = `*Rishikesh Homestays Booking Request*\n\n`;

  msg += `*Guest Details:*\n`;
  msg += `- Name: ${data.name}\n`;
  msg += `- Phone: ${data.phone}\n`;
  if (data.email) msg += `- Email: ${data.email}\n`;
  if (data.coming_from_city) msg += `- Coming from: ${data.coming_from_city}\n`;
  msg += `\n`;

  if (data.check_in || data.check_out) {
    msg += `*Travel Dates:*\n`;
    if (data.check_in) msg += `- Check-in: ${data.check_in}\n`;
    if (data.check_out) msg += `- Check-out: ${data.check_out}\n`;
    msg += `\n`;
  }

  msg += `*Guest Count:*\n`;
  msg += `- Adults: ${adults}\n`;
  msg += `- Children: ${children}\n`;
  msg += `- Pets: ${data.pets && data.pets !== 'none' ? `${data.pets} (${petCount})` : 'none'}\n`;
  msg += `\n`;

  if (data.preferred_stay) msg += `- Preferred homestay: ${data.preferred_stay}\n`;
  if (data.area) msg += `- Preferred area: ${data.area}\n`;
  if (data.preferred_stay || data.area) msg += `\n`;

  if (data.details) {
    msg += `*Trip Details:*\n${data.details}\n\n`;
  }

  msg += `---\n_Sent from Rishikesh Homestays_`;

  return msg;
}

let checkinPicker = null;
let checkoutPicker = null;

// Wires up a calendar picker for check-in/check-out with date-range
// enforcement: check-out can never be on or before check-in.
export function setupContactDatePickers() {
  if (typeof window.flatpickr !== 'function') return;

  const checkinInput = document.getElementById('check_in');
  const checkoutInput = document.getElementById('check_out');
  const datesError = document.getElementById('dates-error');
  if (!checkinInput || !checkoutInput) return;

  checkoutPicker = window.flatpickr(checkoutInput, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd M Y',
    minDate: 'today'
  });

  checkinPicker = window.flatpickr(checkinInput, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd M Y',
    minDate: 'today',
    onChange: (selectedDates) => {
      if (datesError) datesError.hidden = true;
      const chosenCheckin = selectedDates[0];
      if (chosenCheckin) {
        const nextDay = new Date(chosenCheckin);
        nextDay.setDate(nextDay.getDate() + 1);
        checkoutPicker.set('minDate', nextDay);

        const currentCheckout = checkoutPicker.selectedDates[0];
        if (currentCheckout && currentCheckout <= chosenCheckin) {
          checkoutPicker.clear();
        }
      }
    }
  });

  checkoutPicker.config.onChange.push(() => {
    if (datesError) datesError.hidden = true;
  });
}

// Contact form submission handler
export function setupContactForm() {
  const form = document.querySelector("#contactForm");

  if (!form) return;

  const btn = form.querySelector("button");
  const status = form.querySelector("[data-form-status]");
  const phoneInput = form.querySelector('#phone');
  const countrySelect = form.querySelector('#country');
  const phoneError = document.getElementById('phone-error');
  const datesError = document.getElementById('dates-error');

  setupCountryPhoneField(countrySelect);

  phoneInput?.addEventListener('input', () => {
    if (phoneError) phoneError.hidden = true;
    phoneInput.classList.remove('field-invalid');
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    // Phone validation
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
    if (phoneError) phoneError.hidden = true;
    phoneInput?.classList.remove('field-invalid');

    // Check-in/check-out date range validation
    const dateRangeResult = validateDateRange(data.check_in, data.check_out);
    if (!dateRangeResult.valid) {
      if (datesError) {
        datesError.textContent = dateRangeResult.message;
        datesError.hidden = false;
      }
      document.getElementById('check_out')?.focus();
      return;
    }
    if (datesError) datesError.hidden = true;

    // Open WhatsApp immediately (must happen synchronously within the user
    // gesture so browsers don't block the popup) with the same formatted
    // message the WhatsApp widget sends, then continue saving to the
    // database below exactly as before.
    const waMessage = buildShortlistMessage(data);
    window.open(buildWhatsAppLink(WHATSAPP_PHONE, waMessage), '_blank', 'noopener,noreferrer');

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending...";
    }

    if (status) {
      status.textContent = "";
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        form.reset();
        document.getElementById('adults').value = 1;
        document.getElementById('children').value = 0;
        document.getElementById('pet_count').value = 0;
        checkinPicker?.clear();
        checkoutPicker?.clear();

        if (status) {
          status.textContent = result.message || "Thank you! We will contact you shortly.";
          status.style.color = "#4CAF50";
        }
      } else {
        if (status) {
          status.textContent = result.message || "Unable to send your inquiry right now.";
          status.style.color = "#f44336";
        }
      }
    } catch (error) {
      if (status) {
        status.textContent = "Unable to send your inquiry right now. Please call us directly.";
        status.style.color = "#f44336";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Request shortlist";
      }
    }
  });
}

// Counter buttons for guests/pets
export function setupCounters() {
  const counterButtons = document.querySelectorAll('.counter-btn');
  counterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const counterName = btn.dataset.counter;
      const action = btn.dataset.action;
      const input = document.querySelector(`#${counterName}`);
      let value = parseInt(input.value) || 0;
      const min = parseInt(input.min) || 0;
      const max = parseInt(input.max) || 999;

      if (action === 'increase') {
        value = Math.min(value + 1, max);
      } else if (action === 'decrease') {
        value = Math.max(value - 1, min);
      }

      input.value = value;
    });
  });
}
