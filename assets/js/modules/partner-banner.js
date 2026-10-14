// Footer sliding banner of OTAs the stays pages link out to (homepage only).
// Reuses OTA_LOGOS (ota-logos.js) so filling in real logo URLs there is the
// only step needed to switch every pill here from text to a real logo image.
import { otaLogo } from './ota-logos.js';

const PARTNERS = ['Booking.com', 'Agoda', 'MakeMyTrip', 'Goibibo', 'Airbnb', 'Trip.com',
  'OYO', 'EaseMyTrip', 'Hotels.com', 'Expedia', 'Cleartrip', 'Hostelworld'];

export function initPartnerBanner() {
  const track = document.querySelector('[data-partner-track]');
  if (!track) return;
  const pill = (name) => {
    const logo = otaLogo(name);
    return `<span class="rhs-partner-pill">${logo ? `<img src="${logo}" alt="${name}" loading="lazy">` : `<span class="rhs-partner-name">${name}</span>`}</span>`;
  };
  // Duplicated once so the CSS marquee can loop seamlessly without a gap.
  track.innerHTML = [...PARTNERS, ...PARTNERS].map(pill).join('');
}
