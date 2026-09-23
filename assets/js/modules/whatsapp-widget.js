// WhatsApp chat widget with popup form, validation, calendar, and DB storage
import { validatePhone, validateDateRange } from './validators.js';
import { setupCountryPhoneField } from './country-select.js';
import { buildWhatsAppLink, isMobileDevice } from './whatsapp-link.js';

const AUTO_POPUP_DELAY_MS = 20000;
const AUTO_POPUP_SESSION_KEY = 'whatsapp_auto_shown';

export function setupWhatsAppWidget() {
  const WHATSAPP_PHONE = '919027212484';

  // Create widget HTML
  const widgetHTML = `
    <div id="whatsapp-widget" class="whatsapp-widget">
      <!-- Floating Action Button -->
      <button id="whatsapp-fab" class="whatsapp-fab" aria-label="Chat on WhatsApp" title="Chat on WhatsApp">
        <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor">
          <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.386.7 4.61 1.902 6.482L4 29l7.72-1.867A11.94 11.94 0 0016.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3zm0 21.75c-1.94 0-3.75-.53-5.303-1.45l-.38-.225-4.582 1.108 1.127-4.463-.248-.394A9.71 9.71 0 016.25 15c0-5.376 4.377-9.75 9.754-9.75 5.375 0 9.746 4.374 9.746 9.75s-4.371 9.75-9.746 9.75zm5.34-7.297c-.293-.147-1.734-.856-2.003-.954-.269-.098-.464-.147-.66.147-.196.293-.758.954-.929 1.15-.171.196-.342.22-.635.073-.293-.147-1.235-.455-2.353-1.452-.87-.776-1.457-1.735-1.628-2.028-.171-.293-.018-.452.128-.598.132-.132.293-.343.44-.514.147-.171.196-.293.293-.488.098-.196.049-.367-.024-.514-.073-.147-.66-1.59-.904-2.178-.238-.572-.48-.494-.66-.503l-.562-.01c-.196 0-.514.073-.783.367-.269.293-1.026 1.002-1.026 2.444s1.05 2.836 1.197 3.032c.147.196 2.067 3.157 5.008 4.427.7.302 1.246.483 1.672.618.702.223 1.34.192 1.845.116.563-.084 1.734-.709 1.979-1.394.244-.685.244-1.271.171-1.394-.073-.122-.269-.196-.562-.343z"/>
        </svg>
      </button>

      <!-- Small non-blocking nudge shown on mobile instead of forcing the
           full form open (avoids intrusive mobile interstitial patterns) -->
      <button id="whatsapp-nudge" class="whatsapp-nudge" type="button" hidden>
        💬 Need help planning your stay?
      </button>

      <!-- Chat Popup -->
      <div id="whatsapp-popup" class="whatsapp-popup" hidden>
        <div class="whatsapp-popup-header">
          <h3>Book Your Stay on WhatsApp</h3>
          <button id="whatsapp-close" class="whatsapp-close" aria-label="Close chat" type="button">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div class="whatsapp-popup-body">
          <form id="whatsapp-form" class="whatsapp-form" novalidate>
            <!-- Personal Info -->
            <div class="whatsapp-section-title">Your Details</div>

            <div class="whatsapp-field">
              <label for="whatsapp-name">Name *</label>
              <input
                type="text"
                id="whatsapp-name"
                name="name"
                required
                placeholder="Your name"
                maxlength="50"
              >
              <span class="whatsapp-error" id="whatsapp-name-error" hidden></span>
            </div>

            <div class="whatsapp-field">
              <label for="whatsapp-phone">Phone (WhatsApp number) *</label>
              <div class="whatsapp-phone-row">
                <select id="whatsapp-country" name="country" aria-label="Country code"></select>
                <input
                  type="tel"
                  id="whatsapp-phone"
                  name="phone"
                  required
                  placeholder="98765 43210"
                  maxlength="20"
                  inputmode="tel"
                  autocomplete="tel"
                >
              </div>
              <span class="whatsapp-error" id="whatsapp-phone-error" hidden></span>
            </div>

            <!-- Travel Dates -->
            <div class="whatsapp-section-title">Travel Dates</div>

            <div class="whatsapp-field">
              <label for="whatsapp-checkin">Check-in Date</label>
              <input
                type="text"
                id="whatsapp-checkin"
                name="checkin"
                placeholder="Select check-in date"
                autocomplete="off"
                readonly
              >
            </div>

            <div class="whatsapp-field">
              <label for="whatsapp-checkout">Check-out Date</label>
              <input
                type="text"
                id="whatsapp-checkout"
                name="checkout"
                placeholder="Select check-out date"
                autocomplete="off"
                readonly
              >
              <span class="whatsapp-error" id="whatsapp-dates-error" hidden></span>
            </div>

            <!-- Guest Count -->
            <div class="whatsapp-section-title">Guests</div>

            <div class="whatsapp-counter-field">
              <label>Adults *</label>
              <div class="whatsapp-counter">
                <button type="button" class="whatsapp-counter-btn" data-counter="adults" data-action="decrease" aria-label="Decrease adults">−</button>
                <input type="number" id="whatsapp-adults" name="adults" value="1" min="1" max="20" readonly aria-label="Number of adults">
                <button type="button" class="whatsapp-counter-btn" data-counter="adults" data-action="increase" aria-label="Increase adults">+</button>
              </div>
            </div>

            <div class="whatsapp-counter-field">
              <label>Children</label>
              <div class="whatsapp-counter">
                <button type="button" class="whatsapp-counter-btn" data-counter="children" data-action="decrease" aria-label="Decrease children">−</button>
                <input type="number" id="whatsapp-children" name="children" value="0" min="0" max="20" readonly aria-label="Number of children">
                <button type="button" class="whatsapp-counter-btn" data-counter="children" data-action="increase" aria-label="Increase children">+</button>
              </div>
            </div>

            <!-- Pets -->
            <div class="whatsapp-section-title">Pets</div>

            <div class="whatsapp-counter-field">
              <label>Number of Pets</label>
              <div class="whatsapp-counter">
                <button type="button" class="whatsapp-counter-btn" data-counter="pets" data-action="decrease" aria-label="Decrease pets">−</button>
                <input type="number" id="whatsapp-pets" name="pets" value="0" min="0" max="10" readonly aria-label="Number of pets">
                <button type="button" class="whatsapp-counter-btn" data-counter="pets" data-action="increase" aria-label="Increase pets">+</button>
              </div>
            </div>

            <!-- Additional Message -->
            <div class="whatsapp-section-title">Your Message</div>

            <div class="whatsapp-field">
              <label for="whatsapp-message">Special Requirements</label>
              <textarea
                id="whatsapp-message"
                name="message"
                placeholder="Any special requests or questions..."
                maxlength="300"
                rows="2"
              ></textarea>
            </div>

          </form>
        </div>

        <div class="whatsapp-footer">
          <button type="submit" form="whatsapp-form" class="whatsapp-btn">
            Send on WhatsApp
          </button>
          <p class="whatsapp-response-time">
            ⏱️ Usually replies within 30 minutes
          </p>
        </div>
      </div>
    </div>
  `;

  // ---------- Validation helpers ----------

  function showFieldError(errorEl, inputEl, message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
    inputEl?.classList.add('whatsapp-input-invalid');
  }

  function clearFieldError(errorEl, inputEl) {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
    inputEl?.classList.remove('whatsapp-input-invalid');
  }

  // ---------- Widget injection ----------

  function injectWidget() {
    if (!document.getElementById('whatsapp-widget')) {
      const footer = document.querySelector('footer');
      if (footer) {
        footer.insertAdjacentHTML('beforebegin', widgetHTML);
      } else {
        document.body.insertAdjacentHTML('beforeend', widgetHTML);
      }
      setupEventListeners();
      setupDatePickers();
      setupCountryPhoneField(document.getElementById('whatsapp-country'));
      setupAutoPopup();
    }
  }

  // After a delay, draw attention to the widget once per browser session —
  // but never if the visitor has already opened it themselves, and never in
  // a way that blocks page content on mobile (auto-opening the full form
  // there would be the kind of intrusive interstitial Google's mobile
  // guidelines specifically discourage, and just feels spammy).
  let userOpenedWidget = false;

  function setupAutoPopup() {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(AUTO_POPUP_SESSION_KEY) === '1';
    } catch {
      // sessionStorage unavailable (privacy mode, etc.) — treat as not shown.
    }
    if (alreadyShown) return;

    // Claim the "shown" flag immediately, not inside the timeout callback.
    // Each page navigation is a fresh script execution with its own timer —
    // if the flag were only written once the timer *fires*, a visitor who
    // browses to a new page before 20s elapses (very normal) would reset
    // the clock, and the popup could pop up again on every single page they
    // spend 20+ seconds on. Claiming the slot up front means it can only
    // ever fire once per browser tab session, on whichever page happens to
    // be open when the first 20-second window completes.
    try {
      sessionStorage.setItem(AUTO_POPUP_SESSION_KEY, '1');
    } catch {
      // Ignore — worst case it may show again next page load.
    }

    setTimeout(() => {
      if (userOpenedWidget) return;

      const popup = document.getElementById('whatsapp-popup');
      const fab = document.getElementById('whatsapp-fab');
      const nudge = document.getElementById('whatsapp-nudge');

      if (isMobileDevice()) {
        // Small, dismissible nudge instead of forcing the form open.
        fab?.classList.add('whatsapp-fab-pulse');
        if (nudge) {
          nudge.hidden = false;
          setTimeout(() => {
            fab?.classList.remove('whatsapp-fab-pulse');
            nudge.hidden = true;
          }, 8000);
        }
      } else if (popup) {
        popup.hidden = false;
      }
    }, AUTO_POPUP_DELAY_MS);
  }

  let checkinPicker = null;
  let checkoutPicker = null;

  function setupDatePickers() {
    if (typeof window.flatpickr !== 'function') {
      // Calendar library not loaded (e.g. blocked) — inputs still work as plain text.
      return;
    }

    const checkinInput = document.getElementById('whatsapp-checkin');
    const checkoutInput = document.getElementById('whatsapp-checkout');
    const datesError = document.getElementById('whatsapp-dates-error');

    checkoutPicker = window.flatpickr(checkoutInput, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd M Y',
      minDate: 'today',
      disableMobile: false
    });

    checkinPicker = window.flatpickr(checkinInput, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd M Y',
      minDate: 'today',
      disableMobile: false,
      onChange: (selectedDates) => {
        clearFieldError(datesError, checkoutInput);
        const chosenCheckin = selectedDates[0];
        if (chosenCheckin) {
          const nextDay = new Date(chosenCheckin);
          nextDay.setDate(nextDay.getDate() + 1);
          checkoutPicker.set('minDate', nextDay);

          // If an existing check-out is now invalid (same day or before), clear it.
          const currentCheckout = checkoutPicker.selectedDates[0];
          if (currentCheckout && currentCheckout <= chosenCheckin) {
            checkoutPicker.clear();
          }
        }
      }
    });

    checkoutPicker.config.onChange.push(() => {
      clearFieldError(datesError, checkoutInput);
    });
  }

  // ---------- Event listeners ----------

  function setupEventListeners() {
    const fab = document.getElementById('whatsapp-fab');
    const popup = document.getElementById('whatsapp-popup');
    const closeBtn = document.getElementById('whatsapp-close');
    const nudge = document.getElementById('whatsapp-nudge');
    const form = document.getElementById('whatsapp-form');
    const nameInput = document.getElementById('whatsapp-name');
    const phoneInput = document.getElementById('whatsapp-phone');
    const countrySelect = document.getElementById('whatsapp-country');
    const nameError = document.getElementById('whatsapp-name-error');
    const phoneError = document.getElementById('whatsapp-phone-error');
    const datesError = document.getElementById('whatsapp-dates-error');

    function hideNudge() {
      nudge.hidden = true;
      fab?.classList.remove('whatsapp-fab-pulse');
    }

    // Toggle popup
    fab?.addEventListener('click', (e) => {
      e.preventDefault();
      userOpenedWidget = true;
      hideNudge();
      popup.hidden = !popup.hidden;
    });

    // Tapping the mobile nudge opens the full form, same as the FAB
    nudge?.addEventListener('click', (e) => {
      e.preventDefault();
      userOpenedWidget = true;
      hideNudge();
      popup.hidden = false;
    });

    // Close popup
    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      userOpenedWidget = true;
      popup.hidden = true;
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        popup.hidden = true;
      }
    });

    // Live phone validation as the user types
    phoneInput?.addEventListener('blur', () => {
      const result = validatePhone(phoneInput.value, countrySelect?.value);
      if (!result.valid && phoneInput.value.trim()) {
        showFieldError(phoneError, phoneInput, result.message);
      } else {
        clearFieldError(phoneError, phoneInput);
      }
    });
    phoneInput?.addEventListener('input', () => clearFieldError(phoneError, phoneInput));
    nameInput?.addEventListener('input', () => clearFieldError(nameError, nameInput));

    // Counter button handling
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('whatsapp-counter-btn')) {
        e.preventDefault();
        const counterType = e.target.dataset.counter;
        const action = e.target.dataset.action;
        const input = document.getElementById(`whatsapp-${counterType}`);

        if (input) {
          let value = parseInt(input.value) || 0;
          const min = parseInt(input.min) || 0;
          const max = parseInt(input.max) || 99;

          if (action === 'increase' && value < max) {
            value++;
          } else if (action === 'decrease' && value > min) {
            value--;
          }

          input.value = value;
        }
      }
    });

    // Form submission
    form?.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const name = String(formData.get('name') || '').trim();
      const phoneRaw = String(formData.get('phone') || '').trim();
      const countryIso2 = formData.get('country');
      const checkin = formData.get('checkin');
      const checkout = formData.get('checkout');
      const adults = formData.get('adults');
      const children = formData.get('children');
      const pets = formData.get('pets');
      const message = String(formData.get('message') || '').trim();

      let hasError = false;

      // Name validation
      if (!name) {
        showFieldError(nameError, nameInput, 'Please enter your name.');
        hasError = true;
      } else {
        clearFieldError(nameError, nameInput);
      }

      // Phone validation
      const phoneResult = validatePhone(phoneRaw, countryIso2);
      if (!phoneResult.valid) {
        showFieldError(phoneError, phoneInput, phoneResult.message);
        hasError = true;
      } else {
        clearFieldError(phoneError, phoneInput);
      }

      // Date range validation (check-out must be after check-in)
      const dateRangeResult = validateDateRange(checkin, checkout);
      const checkoutInputEl = document.getElementById('whatsapp-checkout');
      if (!dateRangeResult.valid) {
        showFieldError(datesError, checkoutInputEl, dateRangeResult.message);
        hasError = true;
      } else {
        clearFieldError(datesError, checkoutInputEl);
      }

      if (hasError) {
        form.querySelector('.whatsapp-input-invalid')?.focus();
        return;
      }

      const normalizedPhone = phoneResult.normalized;

      // Build comprehensive message for WhatsApp. Plain ASCII only (no
      // emoji, no unicode bullets) — some WhatsApp clients/fonts render
      // those as a broken "tofu" character, especially as the first
      // character of the message.
      let waMessage = `*Rishikesh Homestays Booking Request*\n\n`;

      waMessage += `*Guest Details:*\n`;
      waMessage += `- Name: ${name}\n`;
      waMessage += `- Phone: ${normalizedPhone}\n\n`;

      if (checkin || checkout) {
        waMessage += `*Travel Dates:*\n`;
        if (checkin) waMessage += `- Check-in: ${checkin}\n`;
        if (checkout) waMessage += `- Check-out: ${checkout}\n\n`;
      }

      waMessage += `*Guest Count:*\n`;
      waMessage += `- Adults: ${adults}\n`;
      waMessage += `- Children: ${children}\n`;
      waMessage += `- Pets: ${pets}\n`;
      waMessage += `- Total: ${parseInt(adults) + parseInt(children)} person(s)\n\n`;

      if (message) {
        waMessage += `*Special Requirements:*\n${message}\n\n`;
      }

      waMessage += `---\n_Sent from Rishikesh Homestays_`;

      // Open WhatsApp immediately (must happen synchronously within the user
      // gesture so browsers don't block the popup). On desktop this goes
      // straight to web.whatsapp.com/send so an already-open WhatsApp Web
      // session lands the message in one hop instead of via the wa.me
      // landing page.
      const waUrl = buildWhatsAppLink(WHATSAPP_PHONE, waMessage);
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      // Best-effort: also store the inquiry in the database via the existing
      // contact API so it shows up alongside regular contact-form inquiries.
      const detailsText = message
        || `WhatsApp widget booking request. Check-in: ${checkin || 'flexible'}, Check-out: ${checkout || 'flexible'}.`;

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: normalizedPhone,
          check_in: checkin || null,
          check_out: checkout || null,
          adults,
          children,
          pets: pets && parseInt(pets) > 0 ? 'yes' : 'none',
          pet_count: pets,
          details: detailsText,
          source: 'whatsapp_widget'
        })
      }).catch((err) => {
        console.error('WhatsApp widget: failed to store inquiry in database', err);
      });

      // Reset form and close popup
      form.reset();
      document.getElementById('whatsapp-adults').value = '1';
      document.getElementById('whatsapp-children').value = '0';
      document.getElementById('whatsapp-pets').value = '0';
      checkinPicker?.clear();
      checkoutPicker?.clear();
      clearFieldError(nameError, nameInput);
      clearFieldError(phoneError, phoneInput);
      clearFieldError(datesError, document.getElementById('whatsapp-checkout'));
      popup.hidden = true;
    });

    // Close popup when clicking outside
    popup?.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.hidden = true;
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectWidget);
  } else {
    injectWidget();
  }

  // Expose global reference
  window.whatsappWidget = {
    open: () => {
      const popup = document.getElementById('whatsapp-popup');
      if (popup) popup.hidden = false;
    },
    close: () => {
      const popup = document.getElementById('whatsapp-popup');
      if (popup) popup.hidden = true;
    }
  };
}
