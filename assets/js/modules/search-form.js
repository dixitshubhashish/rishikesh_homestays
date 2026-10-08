// Search form and area dropdown functionality
import { qs, qsa } from './dom-helpers.js';
import { AREAS } from './data.js';
import { CITY_AREAS } from './city-areas.js';

export function setupQuickSearch() {
  const form = qs("[data-search-form]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const city = formData.get("city") || "rishikesh";
    const params = new URLSearchParams();
    // Rishikesh: our own homestays page, filtered. Any other city: that city's list of every stay, narrowed to the area.
    if (city !== "rishikesh") {
      const area = formData.get("area");
      window.location.href = `/hotels/${city}-accommodation${area ? `?area=${encodeURIComponent(area)}` : ""}`;
      return;
    }
    ["area", "travellers", "checkin", "checkout"].forEach((key) => {
      const value = formData.get(key);
      if (value) params.set(key, value);
    });
    window.location.href = `/homestays?${params.toString()}#stays`;
  });
}

// The homepage search's City list (owner, 2026-10-08): always Rishikesh when the page opens (also after Back or a reload, when
// a browser would restore an old choice), and the Area list follows the city. A city with no built stays pages is not offered.
function setupCityPicker(form) {
  const city = form.querySelector("#city");
  const area = form.querySelector("#area");
  if (!city || !area) return;
  [...city.options].forEach((o) => { if (o.value !== "rishikesh" && !CITY_AREAS[o.value]) o.remove(); });
  const fillAreas = () => {
    [...area.options].slice(1).forEach((o) => o.remove());
    (city.value === "rishikesh" ? AREAS : CITY_AREAS[city.value] || []).forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      area.append(option);
    });
    area.value = "";
  };
  const reset = () => { city.value = "rishikesh"; fillAreas(); };
  city.addEventListener("change", fillAreas);
  window.addEventListener("pageshow", (e) => { if (e.persisted) reset(); });
  reset();
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
  const homeForm = qs("[data-search-form]");
  if (homeForm) setupCityPicker(homeForm);
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
