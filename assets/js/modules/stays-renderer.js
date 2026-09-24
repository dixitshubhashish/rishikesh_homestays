// Homestay card rendering and filtering
import { qs, qsa } from './dom-helpers.js';
import { STAYS, AREAS } from './data.js';
import { setupCurrencyConversion } from './currency.js';

export function createStayCard(stay) {
  const tagMarkup = stay.tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  // Only stays with their own dedicated page (detailUrl) are clickable —
  // the rest don't have anywhere to link to yet, so the photo/title stay
  // as plain (non-link) elements for those, same as before.
  const photo = stay.detailUrl
    ? `<a class="homestay-photo ${stay.imageClass}" href="${stay.detailUrl}" aria-label="View ${stay.name}"></a>`
    : `<div class="homestay-photo ${stay.imageClass}" aria-hidden="true"></div>`;
  const title = stay.detailUrl
    ? `<h3><a href="${stay.detailUrl}">${stay.name}</a></h3>`
    : `<h3>${stay.name}</h3>`;
  return `
    <article class="homestay-card" data-area="${stay.area}" data-type="${stay.type}" data-budget="${stay.budget}">
      ${photo}
      <div class="card-body">
        <div class="card-topline">
          <span>${stay.area} / ${stay.type}</span>
          <span class="price"${stay.priceINR ? ` data-price-inr="${stay.priceINR}"` : ""}>${stay.price}</span>
        </div>
        ${title}
        <p>${stay.summary}</p>
        <div class="tag-row">${tagMarkup}</div>
        <div class="card-actions">
          <a class="btn btn-primary" href="/contact?stay=${encodeURIComponent(stay.name)}">Send enquiry</a>
          <a class="btn btn-secondary" href="/homestays">Compare stays</a>
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
    : '<div class="empty-state">No stays match these filters yet. Send an enquiry and we will suggest the closest fit.</div>';

  setupCurrencyConversion();
}

export function hydrateFilters() {
  const filterArea = qs("[data-filter-area]");
  if (!filterArea) return;

  // Use the canonical AREAS list (same one the homepage search and contact
  // forms use), not just whichever areas the current sample STAYS data
  // happens to cover — otherwise this filter silently shows fewer areas
  // than the rest of the site and looks inconsistent/broken.
  const areas = ["All", ...AREAS];
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
