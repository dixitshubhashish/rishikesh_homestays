import { validatePhone } from './validators.js';
import { setupCountryPhoneField } from './country-select.js';
import { buildWhatsAppLink } from './whatsapp-link.js';

const WHATSAPP_PHONE = '919027212484';

// Formats a host's property application as a plain-text WhatsApp message
// (no emoji/unicode bullets — some WhatsApp clients render those as a
// broken "tofu" character), matching the guest-facing forms' style.
function buildHostMessage(data) {
  let msg = `*New Homestay Listing Application*\n\n`;

  msg += `*Host Details:*\n`;
  msg += `- Name: ${data.name}\n`;
  msg += `- Phone: ${data.phone}\n`;
  if (data.email) msg += `- Email: ${data.email}\n`;
  msg += `\n`;

  msg += `*Property Details:*\n`;
  if (data.property_name) msg += `- Property name: ${data.property_name}\n`;
  if (data.area) msg += `- Area: ${data.area}\n`;
  if (data.property_type) msg += `- Type: ${data.property_type}\n`;
  if (data.room_count) msg += `- Rooms available: ${data.room_count}\n`;
  msg += `\n`;

  if (data.details) {
    msg += `*Description:*\n${data.details}\n\n`;
  }

  msg += `---\n_Sent from Rishikesh Homestays - List Your Homestay_`;

  return msg;
}

export function setupHostForm() {
  const form = document.querySelector('#hostForm');
  if (!form) return;

  // See contact-form.js for why this must target the submit button
  // specifically, not just the first <button> in the form.
  const btn = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-form-status]');
  const phoneInput = form.querySelector('#host_phone');
  const countrySelect = form.querySelector('#host_country');
  const phoneError = document.getElementById('host-phone-error');

  setupCountryPhoneField(countrySelect);

  phoneInput?.addEventListener('input', () => {
    if (phoneError) phoneError.hidden = true;
    phoneInput.classList.remove('field-invalid');
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

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

    // Open WhatsApp immediately (must happen synchronously within the user
    // gesture so browsers don't block the popup), then save to the database
    // below exactly like the other forms.
    const waMessage = buildHostMessage(data);
    window.open(buildWhatsAppLink(WHATSAPP_PHONE, waMessage), '_blank', 'noopener,noreferrer');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }
    if (status) status.textContent = '';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source: 'host_application' })
      });

      const result = await response.json();

      if (result.success) {
        form.reset();
        if (status) {
          status.textContent = result.message || 'Thank you! Our team will contact you shortly to verify your property.';
          status.style.color = '#4CAF50';
        }
      } else if (status) {
        status.textContent = result.message || 'Unable to submit your application right now.';
        status.style.color = '#f44336';
      }
    } catch (error) {
      if (status) {
        status.textContent = 'Unable to submit your application right now. Please message us on WhatsApp instead.';
        status.style.color = '#f44336';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Submit application';
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupHostForm);
} else {
  setupHostForm();
}
