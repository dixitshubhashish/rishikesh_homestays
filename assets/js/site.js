// Backward compatibility shim - imports from modular structure
// This file is kept for compatibility with existing HTML that references assets/js/site.js

import { AREAS, STAYS } from './modules/data.js';
import { qs, qsa } from './modules/dom-helpers.js';
import { createStayCard, renderStays, hydrateFilters } from './modules/stays-renderer.js';
import { setupNav } from './modules/nav.js';
import { setupQuickSearch, setupAreaDropdowns, setupDatePickers } from './modules/search-form.js';
import { setupEnquiryPrefill, applyListingParams } from './modules/enquiry-prefill.js';
import { enhanceStaticWhatsAppLinks } from './modules/whatsapp-link.js';
import { setupPageTabs } from './modules/page-tabs.js';
import { setupHeroSlideshow } from './modules/hero-slideshow.js';

// Re-export for any inline script usage
window.AREAS = AREAS;
window.STAYS = STAYS;
window.qs = qs;
window.qsa = qsa;
window.createStayCard = createStayCard;
window.renderStays = renderStays;
window.hydrateFilters = hydrateFilters;
window.setupNav = setupNav;
window.setupQuickSearch = setupQuickSearch;
window.setupEnquiryPrefill = setupEnquiryPrefill;
window.applyListingParams = applyListingParams;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  setupQuickSearch();
  setupAreaDropdowns();
  setupDatePickers();
  hydrateFilters();
  applyListingParams();
  renderStays(qs("[data-stay-grid]")?.dataset.limit ? Number(qs("[data-stay-grid]").dataset.limit) : undefined);
  setupEnquiryPrefill();
  enhanceStaticWhatsAppLinks();
  setupPageTabs();
  setupHeroSlideshow();
});