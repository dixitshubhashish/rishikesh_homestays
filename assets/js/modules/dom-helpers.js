// DOM query helpers
export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

// Safe element getters that handle missing elements gracefully
export const getSafe = (selector, scope = document) => {
  const el = qs(selector, scope);
  if (!el) console.warn(`Element not found: ${selector}`);
  return el;
};

// Add class with validation
export const addClass = (el, className) => {
  if (el) el.classList.add(className);
};

// Remove class with validation
export const removeClass = (el, className) => {
  if (el) el.classList.remove(className);
};

// Toggle class with validation
export const toggleClass = (el, className) => {
  if (el) el.classList.toggle(className);
  return el ? el.classList.contains(className) : false;
};

// Set attribute with validation
export const setAttr = (el, attr, value) => {
  if (el) el.setAttribute(attr, value);
};

// Get attribute with validation
export const getAttr = (el, attr) => {
  return el ? el.getAttribute(attr) : null;
};
