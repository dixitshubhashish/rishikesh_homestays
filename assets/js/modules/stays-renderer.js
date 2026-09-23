// Homestay card rendering and filtering
import { qs, qsa } from './dom-helpers.js';
import { STAYS } from './data.js';

export function createStayCard(stay) {
  const tagMarkup = stay.tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  return `
    <article class="homestay-card" data-area="${stay.area}" data-type="${stay.type}" data-budget="${stay.budget}">
      <div class="homestay-photo ${stay.imageClass}" aria-hidden="true"></div>
      <div class="card-body">
        <div class="card-topline">
          <span>${stay.area} / ${stay.type}</span>
          <span class="price">${stay.price}</span>
        </div>
        <h3>${stay.name}</h3>
        <p>${stay.summary}</p>
        <div class="tag-row">${tagMarkup}</div>
        <div class="card-actions">
          <a class="btn btn-primary" href="/pages/contact.html?stay=${encodeURIComponent(stay.name)}">Send inquiry</a>
          <a class="btn btn-secondary" href="/pages/homestays.html">Compare stays</a>
        </div>
      </div>
    </article>
  `;
}

export function renderStays(limit) {
  const grid = qs("[data-stay-grid]");
  if (!grid) return;

  const area = qs("[data-filter-area]")?.value || "All";
  const type = qs("[data-filter-type]")?.value || "All";
  const budget = qs("[data-filter-budget]")?.value || "All";

  const filtered = STAYS.filter((stay) => (
    (area === "All" || stay.area === area) &&
    (type === "All" || stay.type === type) &&
    (budget === "All" || stay.budget === budget)
  ));

  const visible = typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  grid.innerHTML = visible.length
    ? visible.map(createStayCard).join("")
    : '<div class="empty-state">No stays match these filters yet. Send an inquiry and we will suggest the closest fit.</div>';
}

export function hydrateFilters() {
  const filterArea = qs("[data-filter-area]");
  if (!filterArea) return;

  const areas = ["All", ...new Set(STAYS.map((stay) => stay.area))];
  const types = ["All", ...new Set(STAYS.map((stay) => stay.type))];
  const budgets = ["All", ...new Set(STAYS.map((stay) => stay.budget))];

  const fill = (select, values) => {
    select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  };

  fill(filterArea, areas);
  fill(qs("[data-filter-type]"), types);
  fill(qs("[data-filter-budget]"), budgets);

  qsa("[data-filter-area], [data-filter-type], [data-filter-budget]").forEach((select) => {
    select.addEventListener("change", () => renderStays());
  });
}
