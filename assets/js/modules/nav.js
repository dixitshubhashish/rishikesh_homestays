// Navigation toggle functionality — mobile nav is a slide-in drawer with a
// dimming backdrop (matches the WhatsApp widget's panel pattern), not a
// dropdown under the header.
import { qs, setAttr } from './dom-helpers.js';

const WHATSAPP_QUICK_ACTION_HREF =
  "https://wa.me/918050091290?text=Hi%20Rishikesh%20Homestays!%20I'd%20like%20to%20book%20a%20stay.";

// The header's brand link/logo and close affordance, injected once so the
// drawer reads as its own self-contained panel (with a way to dismiss it
// from inside) instead of just a list of links with no chrome of its own.
function buildDrawerHeader(nav) {
  if (nav.querySelector('.nav-drawer-header')) return;
  const header = document.createElement('div');
  header.className = 'nav-drawer-header';
  header.innerHTML = `
    <a href="/" class="nav-drawer-brand" aria-label="Rishikesh Homestays">
      <img src="/assets/images/logo.png" alt="" class="nav-drawer-logo">
      <span>Rishikesh Homestays</span>
    </a>
    <button type="button" class="nav-drawer-close" aria-label="Close menu">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>`;
  nav.insertBefore(header, nav.firstChild);
}

// Quick-action WhatsApp button + phone/email + social icons, so the drawer
// covers the same "how do I reach you" needs as the footer, without making
// a visitor close the menu and scroll to the bottom of the page first.
function buildDrawerFooter(nav) {
  if (nav.querySelector('.nav-drawer-footer')) return;
  const footer = document.createElement('div');
  footer.className = 'nav-drawer-footer';
  footer.innerHTML = `
    <a class="btn btn-whatsapp nav-drawer-quick-action" href="${WHATSAPP_QUICK_ACTION_HREF}" target="_blank" rel="noopener">Book on WhatsApp</a>
    <div class="nav-drawer-contact">
      <a href="tel:+918050091290">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>
        +91 80500 91290
      </a>
      <a href="mailto:hello@rishikeshhomestays.com">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        hello@rishikeshhomestays.com
      </a>
    </div>
    <div class="nav-drawer-social">
      <a href="https://wa.me/918050091290" aria-label="WhatsApp" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>
      </a>
      <a href="https://www.instagram.com/rishikesh.homestays" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5"/></svg>
      </a>
      <a href="https://www.facebook.com/profile.php?id=61574309741427" aria-label="Facebook" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
      </a>
    </div>`;
  nav.appendChild(footer);
}

export function setupNav() {
  const toggle = qs("[data-nav-toggle]");
  const nav = qs("[data-nav]");
  if (!toggle || !nav) return;

  buildDrawerHeader(nav);
  buildDrawerFooter(nav);

  // Injected once, reused across opens/closes — same pattern as
  // whatsapp-widget.js's backdrop.
  let backdrop = document.querySelector('.nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
  }

  function open() {
    nav.classList.add('is-open');
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
    setAttr(toggle, "aria-expanded", "true");
  }

  function close() {
    nav.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    setAttr(toggle, "aria-expanded", "false");
    setTimeout(() => { backdrop.hidden = true; }, 350);
  }

  toggle.addEventListener("click", () => {
    if (nav.classList.contains('is-open')) close(); else open();
  });

  backdrop.addEventListener('click', close);

  nav.querySelector('.nav-drawer-close')?.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) close();
  });

  // Closing after a link click makes the drawer feel like real in-app
  // navigation, not something the visitor has to remember to dismiss.
  // closest('a'), not tagName === 'A' — the contact/social links wrap an
  // <svg> icon, so a tap on the icon itself would otherwise report the
  // <svg> as e.target and miss the check.
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) close();
  });
}
