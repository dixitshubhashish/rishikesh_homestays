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
    ["area", "travellers", "date"].forEach((key) => {
      const value = formData.get(key);
      if (value) params.set(key, value);
    });
    window.location.href = `/pages/homestays?${params.toString()}#stays`;
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

// Uses the same flatpickr setup (dateFormat/altFormat/minDate) as the main
// contact form and the WhatsApp widget, so the "arrival date" field here
// behaves identically — same calendar UI, same "no past dates" rule —
// instead of falling back to a plain native <input type="date"> that
// allows picking a date that's already gone.
export function setupDatePickers() {
  if (typeof window.flatpickr !== 'function') return;

  document.querySelectorAll('#date').forEach(input => {
    window.flatpickr(input, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd M Y',
      minDate: 'today'
    });
  });
}
