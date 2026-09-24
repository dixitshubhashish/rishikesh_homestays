// Search form and area dropdown functionality
import { qs, qsa } from './dom-helpers.js';
import { AREAS } from './data.js';

export function setupQuickSearch() {
  const form = qs("[data-search-form]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const params = new URLSearchParams();
    ["area", "travellers", "checkin", "checkout"].forEach((key) => {
      const value = formData.get(key);
      if (value) params.set(key, value);
    });
    window.location.href = `/homestays?${params.toString()}#stays`;
  });
}

export function setupAreaDropdowns() {
  document.querySelectorAll(".area-dropdown").forEach(select => {
    // Insert right after the first (placeholder) option, so any trailing
    // custom option already in the markup — e.g. list-your-homestay.html's
    // "Other (mention in message)" — stays last instead of getting pushed
    // above the appended areas.
    const insertBeforeNode = select.options[1] || null;
    AREAS.forEach(area => {
      const option = document.createElement("option");
      option.value = area;
      option.textContent = area;
      select.insertBefore(option, insertBeforeNode);
    });
  });
}

// Uses the same flatpickr setup (dateFormat/altFormat/minDate, and the same
// checkin->checkout minDate linking) as the main contact form and the
// WhatsApp widget, so this quick-search bar behaves identically — same
// calendar UI, same "no past dates" rule, checkout can't be before checkin —
// instead of a single vague "arrival date" field.
export function setupDatePickers() {
  if (typeof window.flatpickr !== 'function') return;

  const checkinInput = document.getElementById('checkin');
  const checkoutInput = document.getElementById('checkout');
  if (!checkinInput || !checkoutInput) return;

  const checkoutPicker = window.flatpickr(checkoutInput, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd M Y',
    minDate: 'today'
  });

  window.flatpickr(checkinInput, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd M Y',
    minDate: 'today',
    onChange: (selectedDates) => {
      const chosenCheckin = selectedDates[0];
      if (!chosenCheckin) return;
      const nextDay = new Date(chosenCheckin);
      nextDay.setDate(nextDay.getDate() + 1);
      checkoutPicker.set('minDate', nextDay);

      const currentCheckout = checkoutPicker.selectedDates[0];
      if (currentCheckout && currentCheckout <= chosenCheckin) {
        checkoutPicker.clear();
      }
    }
  });
}
