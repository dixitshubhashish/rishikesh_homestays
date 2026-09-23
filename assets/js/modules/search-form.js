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

export function setupDatePickers() {
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.addEventListener('click', () => {
      if (input.showPicker) {
        input.showPicker();
      }
    });
  });
}
