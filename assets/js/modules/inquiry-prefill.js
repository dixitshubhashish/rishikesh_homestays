// Prefill inquiry form with selected homestay from URL params
import { qs } from './dom-helpers.js';

export function setupInquiryPrefill() {
  const params = new URLSearchParams(window.location.search);
  const stay = params.get("stay");
  const target = qs("[name='preferred_stay']");
  if (stay && target) {
    target.value = stay;
  }
}

export function applyListingParams() {
  const params = new URLSearchParams(window.location.search);
  const area = params.get("area");
  const filterArea = qs("[data-filter-area]");
  if (area && filterArea) {
    filterArea.value = area;
  }
}
