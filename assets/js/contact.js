// Backward compatibility shim - imports from modular structure
// This file is kept for compatibility with existing HTML that references assets/js/contact.js

import { setupContactForm, setupCounters, setupContactDatePickers } from './modules/contact-form.js';

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  setupCounters();
  setupContactForm();
  setupContactDatePickers();
});
