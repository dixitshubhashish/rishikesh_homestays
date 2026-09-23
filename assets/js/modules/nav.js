// Navigation toggle functionality
import { qs, toggleClass, setAttr } from './dom-helpers.js';

export function setupNav() {
  const toggle = qs("[data-nav-toggle]");
  const nav = qs("[data-nav]");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = toggleClass(nav, "is-open");
    setAttr(toggle, "aria-expanded", String(isOpen));
  });
}
