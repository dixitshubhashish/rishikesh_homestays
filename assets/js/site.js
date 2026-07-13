const AREAS = [
  "Tapovan",
  "Ganga Barrage",
  "Veerbhadra Temple",
  "Nirmal Bagh near Ganges",
  "AIIMS Rishikesh",
  "Triveni Ghat",
  "Neelkanth Road",
  "Bypass Road",
  "Nepali Farm"
];

const stays = [
  {
    name: "Advaitam Ganga & Hill View Luxury 3BHK by Ganges Homestay",
    area: "Nirmal Bagh",
    type: "Family",
    budget: "Premium",
    price: "From ₹12,800",
    imageClass: "one",
    summary: "Three bedroom family stay with balcony breakfast, fast Wi-Fi, and easy access to cafes and yoga studios.",
    tags: ["3 bedrooms","Sunrise View", "Balcony", "Kitchen access", "Walkable Cafes", "Nearby Ghats"]
  },
  {
    name: "Yoga Retreat at the Ganges ",
    area: "Veerbhadra Temple",
    type: "Wellness",
    budget: "Mid-range",
    price: "From ₹3,600",
    imageClass: "two",
    summary: "Quiet private rooms with mountain near AIIMS, river walks 900m, vegetarian meals, and sunrise practice spaces.",
    tags: ["Yoga friendly", "Self-serve kitchen", "Quiet lane", "Solo travellers", "Nearby Ghats"]
  },
  {
    name: "Ganga & Hill View Couple Retreat",
    area: "Ganga Barrage",
    type: "Nature",
    budget: "Budget",
    price: "From ₹3,200",
    imageClass: "three",
    summary: "A peaceful cottage for couples and small groups looking for green views and a slower Rishikesh stay near Ghats.",
    tags: ["Forest view", "Private sit-out", "Balcony view", "Driver parking", "Nearby Ghats"]
  },
  {
    name: "Lakshman Jhula Studio Stay",
    area: "Tapovan",
    type: "Workation",
    budget: "Mid-range",
    price: "From ₹6,400",
    imageClass: "two",
    summary: "Compact studio with desk, kitchenette, inverter backup, and quick access to rafting pickup points.",
    tags: ["Work desk", "Kitchenette", "Power backup", "Rafting pickup"]
  },
  {
    name: "Triveni Ghat Heritage Home",
    area: "Triveni Ghat",
    type: "Family",
    budget: "Budget",
    price: "From ₹9,900",
    imageClass: "three",
    summary: "Simple, clean rooms close to evening aarti, local markets, and early morning riverside walks.",
    tags: ["Near aarti", "Market access", "Senior friendly", "Local host"]
  },
  {
    name: "Hill Balcony Retreat",
    area: "Muni Ki Reti",
    type: "Couples",
    budget: "Premium",
    price: "From ₹6,900",
    imageClass: "one",
    summary: "Private balcony rooms with mountain air, curated cafe recommendations, and relaxed check-in support.",
    tags: ["Mountain view", "Couple friendly", "Cafe guide", "Late check-in"]
  }
];

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function createStayCard(stay) {
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

function renderStays(limit) {
  const grid = qs("[data-stay-grid]");
  if (!grid) return;

  const area = qs("[data-filter-area]")?.value || "All";
  const type = qs("[data-filter-type]")?.value || "All";
  const budget = qs("[data-filter-budget]")?.value || "All";

  const filtered = stays.filter((stay) => (
    (area === "All" || stay.area === area) &&
    (type === "All" || stay.type === type) &&
    (budget === "All" || stay.budget === budget)
  ));

  const visible = typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  grid.innerHTML = visible.length
    ? visible.map(createStayCard).join("")
    : '<div class="empty-state">No stays match these filters yet. Send an inquiry and we will suggest the closest fit.</div>';
}

function hydrateFilters() {
  const filterArea = qs("[data-filter-area]");
  if (!filterArea) return;

  const areas = ["All", ...new Set(stays.map((stay) => stay.area))];
  const types = ["All", ...new Set(stays.map((stay) => stay.type))];
  const budgets = ["All", ...new Set(stays.map((stay) => stay.budget))];

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

function setupNav() {
  const toggle = qs("[data-nav-toggle]");
  const nav = qs("[data-nav]");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function setupInquiryPrefill() {
  const params = new URLSearchParams(window.location.search);
  const stay = params.get("stay");
  const target = qs("[name='preferred_stay']");
  if (stay && target) {
    target.value = stay;
  }
}

function setupQuickSearch() {
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
    window.location.href = `/pages/homestays.html?${params.toString()}#stays`;
  });
}

document.querySelectorAll(".area-dropdown").forEach(select => {
    AREAS.forEach(area => {
        const option = document.createElement("option");
        option.value = area;
        option.textContent = area;
        select.appendChild(option);
    });
});

function applyListingParams() {
  const params = new URLSearchParams(window.location.search);
  const area = params.get("area");
  const filterArea = qs("[data-filter-area]");
  if (area && filterArea) {
    filterArea.value = area;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  setupQuickSearch();
  hydrateFilters();
  applyListingParams();
  renderStays(qs("[data-stay-grid]")?.dataset.limit ? Number(qs("[data-stay-grid]").dataset.limit) : undefined);
  setupInquiryPrefill();
});

document.querySelectorAll('input[type="date"]').forEach(input => {

    input.addEventListener('click', () => {
        if (input.showPicker) {
            input.showPicker();
        }
    });

});