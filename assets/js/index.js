// Main entry point - orchestrates all modules
import { setupNav } from './modules/nav.js';
import { setupQuickSearch, setupAreaDropdowns, setupDatePickers } from './modules/search-form.js';
import { hydrateFilters, renderStays } from './modules/stays-renderer.js';
import { setupEnquiryPrefill, applyListingParams } from './modules/enquiry-prefill.js';

// Initialize all functionality when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Navigation
  setupNav();

  // Search and area dropdowns
  setupQuickSearch();
  setupAreaDropdowns();
  setupDatePickers();

  // Stays grid and filtering
  hydrateFilters();
  applyListingParams();
  const gridElement = document.querySelector("[data-stay-grid]");
  const limit = gridElement?.dataset.limit ? Number(gridElement.dataset.limit) : undefined;
  renderStays(limit);

  // Enquiry form prefilling
  setupEnquiryPrefill();
});
