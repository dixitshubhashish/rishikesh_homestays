// Shared busy-state helper for every "-ing" button across the site (Send
// enquiry -> Sending..., Submit application -> Submitting..., etc.) so they
// all get the same spinning indicator instead of plain text, and so the
// original label is always restored exactly (not a hardcoded guess).
export function setButtonLoading(btn, label) {
  if (!btn) return;
  if (btn.dataset.originalLabel === undefined) {
    btn.dataset.originalLabel = btn.textContent;
  }
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${label}`;
}

export function clearButtonLoading(btn) {
  if (!btn) return;
  btn.disabled = false;
  if (btn.dataset.originalLabel !== undefined) {
    btn.textContent = btn.dataset.originalLabel;
    delete btn.dataset.originalLabel;
  }
}
