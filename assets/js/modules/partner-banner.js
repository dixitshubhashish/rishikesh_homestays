// Footer sliding banner of OTAs the stays pages link out to (homepage only).
// Reuses OTA_LOGOS (ota-logos.js) so filling in real logo URLs there is the
// only step needed to switch every pill here from text to a real logo image.
//
// Builds its own container rather than relying on a static HTML hook: the
// shared footer markup (thanks.html) is synced verbatim onto every page by
// footer_links.py, so any hook placed only in index.html's footer gets wiped
// out the next time that sync runs. Self-inserting here keeps this homepage-only
// widget independent of that shared-footer sync entirely.
import { otaLogo } from './ota-logos.js';

const PARTNERS = ['Booking.com', 'Agoda', 'MakeMyTrip', 'Goibibo', 'Airbnb', 'Trip.com',
  'OYO', 'EaseMyTrip', 'Hotels.com', 'Expedia', 'Cleartrip', 'Hostelworld'];

export function initPartnerBanner() {
  if (location.pathname !== '/' && location.pathname !== '/index.html') return;
  const bottom = document.querySelector('.rhs-footer-bottom .rhs-footer-bottom-inner');
  if (!bottom || document.querySelector('[data-partner-track]')) return;
  const banner = document.createElement('div');
  banner.className = 'rhs-partner-banner';
  banner.setAttribute('aria-label', 'Official booking partners');
  banner.innerHTML = '<p class="rhs-partner-banner-label">Official Partner</p>'
    + '<div class="rhs-partner-banner-track" data-partner-track></div>';
  bottom.before(banner);
  const track = banner.querySelector('[data-partner-track]');
  const pill = (name) => {
    const logo = otaLogo(name);
    return `<span class="rhs-partner-pill">${logo ? `<img src="${logo}" alt="${name}" loading="lazy">` : `<span class="rhs-partner-name">${name}</span>`}</span>`;
  };
  // Duplicated once so the CSS marquee can loop seamlessly without a gap.
  track.innerHTML = [...PARTNERS, ...PARTNERS].map(pill).join('');
}
