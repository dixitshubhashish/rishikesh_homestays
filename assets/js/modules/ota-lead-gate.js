// "Book on Airbnb / Booking.com / MakeMyTrip" links pay those platforms a
// commission and give us no way to follow up with the guest. Before sending
// a visitor off to one of those listings, this captures their name + phone
// (mirroring the WhatsApp widget's validation) and emails it to the team via
// the existing /api/contact endpoint — awaited, so the redirect only happens
// once the enquiry is actually acknowledged, not fired-and-forgotten.
import { validatePhone } from './validators.js';
import { setupCountryPhoneField } from './country-select.js';
import { setButtonLoading, clearButtonLoading } from './button-loading.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

let libphonenumberPromise = null;
function ensureLibphonenumber() {
  if (typeof window.libphonenumber === 'object') return Promise.resolve();
  if (!libphonenumberPromise) {
    libphonenumberPromise = loadScript('/assets/vendor/libphonenumber/libphonenumber-min.js')
      .catch((err) => console.error('OTA lead gate: failed to load phone number library', err));
  }
  return libphonenumberPromise;
}

const MODAL_HTML = `
  <div class="ota-gate-backdrop" hidden></div>
  <div class="ota-gate-modal" hidden role="dialog" aria-modal="true" aria-labelledby="ota-gate-title">
    <button type="button" class="ota-gate-close" aria-label="Close">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
    <h3 id="ota-gate-title">Before you head to <span data-ota-gate-name>Airbnb</span></h3>
    <p>Leave your name and number so we can also help directly with dates, long-stay discounts, and questions — then we'll take you straight there.</p>
    <form class="ota-gate-form" novalidate>
      <div class="whatsapp-field">
        <label for="ota-gate-name">Name *</label>
        <input type="text" id="ota-gate-name" name="name" required placeholder="Your name" maxlength="50">
        <span class="whatsapp-error" data-ota-gate-name-error hidden></span>
      </div>
      <div class="whatsapp-field">
        <label for="ota-gate-phone">Phone *</label>
        <div class="whatsapp-phone-row">
          <select id="ota-gate-country" aria-label="Country code"></select>
          <input type="tel" id="ota-gate-phone" name="phone" required placeholder="98765 43210" inputmode="tel" autocomplete="tel">
        </div>
        <span class="whatsapp-error" data-ota-gate-phone-error hidden></span>
      </div>
      <button type="submit" class="btn btn-primary ota-gate-submit">Continue to <span data-ota-gate-name>Airbnb</span></button>
    </form>
  </div>
`;

export function setupOtaLeadGate() {
  const links = document.querySelectorAll('[data-ota-url]');
  if (!links.length) return;

  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
  const backdrop = document.querySelector('.ota-gate-backdrop');
  const modal = document.querySelector('.ota-gate-modal');
  const form = modal.querySelector('.ota-gate-form');
  const nameInput = document.getElementById('ota-gate-name');
  const phoneInput = document.getElementById('ota-gate-phone');
  const countrySelect = document.getElementById('ota-gate-country');
  const nameError = modal.querySelector('[data-ota-gate-name-error]');
  const phoneError = modal.querySelector('[data-ota-gate-phone-error]');
  const nameLabels = modal.querySelectorAll('[data-ota-gate-name]');

  let countryFieldReady = false;
  let pendingUrl = null;
  let pendingOtaName = null;

  function showFieldError(errorEl, inputEl, message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    inputEl.classList.add('whatsapp-input-invalid');
  }
  function clearFieldError(errorEl, inputEl) {
    errorEl.textContent = '';
    errorEl.hidden = true;
    inputEl.classList.remove('whatsapp-input-invalid');
  }

  function openModal(url, otaName) {
    pendingUrl = url;
    pendingOtaName = otaName;
    nameLabels.forEach((el) => { el.textContent = otaName; });
    ensureLibphonenumber().then(() => {
      if (!countryFieldReady) {
        countryFieldReady = true;
        setupCountryPhoneField(countrySelect);
      }
    });
    backdrop.hidden = false;
    modal.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      modal.classList.add('is-open');
    });
    nameInput.focus();
  }

  function closeModal() {
    backdrop.classList.remove('is-open');
    modal.classList.remove('is-open');
    const finish = () => { backdrop.hidden = true; modal.hidden = true; };
    modal.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 350);
  }

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(link.dataset.otaUrl, link.dataset.otaName || 'the listing');
    });
  });

  backdrop.addEventListener('click', closeModal);
  modal.querySelector('.ota-gate-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  phoneInput.addEventListener('input', () => clearFieldError(phoneError, phoneInput));
  nameInput.addEventListener('input', () => clearFieldError(nameError, nameInput));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    let hasError = false;

    if (!name) {
      showFieldError(nameError, nameInput, 'Please enter your name.');
      hasError = true;
    } else {
      clearFieldError(nameError, nameInput);
    }

    const phoneResult = validatePhone(phoneInput.value, countrySelect.value);
    if (!phoneResult.valid) {
      showFieldError(phoneError, phoneInput, phoneResult.message);
      hasError = true;
    } else {
      clearFieldError(phoneError, phoneInput);
    }

    if (hasError) return;

    // Wait for the enquiry to actually be acknowledged before sending the
    // guest onward — a fire-and-forget request gave no visible confirmation
    // that anything was captured at all, which read as "nothing happened."
    const submitBtn = form.querySelector('.ota-gate-submit');
    setButtonLoading(submitBtn, 'Sending...');
    clearFieldError(phoneError, phoneInput);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: phoneResult.normalized,
          // Never shown to the guest — this is purely for the team's own
          // notification email/BigQuery record, so it's fine (useful, even)
          // to spell out exactly which button and URL they clicked.
          details: `Clicked through to the ${pendingOtaName} listing for Advaitam Ganga & Hill View Luxury 3BHK.\nButton clicked: ${pendingOtaName}\nDestination URL: ${pendingUrl}`,
          source: `ota_redirect_${pendingOtaName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
        })
      });
      const result = await response.json().catch(() => ({ success: false }));
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Request failed');
      }

      const url = pendingUrl;
      form.reset();
      closeModal();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('OTA lead gate: failed to record enquiry', err);
      showFieldError(phoneError, phoneInput, "Couldn't reach us just now — please try again in a moment.");
    } finally {
      clearButtonLoading(submitBtn);
    }
  });
}
