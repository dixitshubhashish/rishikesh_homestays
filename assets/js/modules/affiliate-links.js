// Affiliate IDs: the single place they live (like GA_MEASUREMENT_ID in
// analytics.js). Every Booking.com link the site, the stays generator and
// BigQuery hand out goes through our CJ (Commission Junction) deep link, which
// redirects to the same Booking.com property page and credits the booking:
//   https://www.kqzyfj.com/click-<CJ_PID>-<CJ_BOOKING_LINK_ID>?url=<page>
// Read by: scripts/stays/build_pages.py (parses the two constants below),
// scripts/stays/push_places.mjs and push_bigquery.mjs (import this module; the
// latter also rebuilds the BigQuery view stays_sheet with them).
// Booking.com APAC must have an active relationship with us in CJ for clicks
// to earn; the link still lands on the right page either way.
export const CJ_PID = '101895722'; // our CJ publisher (website) ID
export const CJ_BOOKING_LINK_ID = '17293139'; // Booking.com link approved in CJ (owner, 2026-10-07; deep linking via ?url=). The homepage search widget keeps the older link 17323528 (assets/js/ads.js).
export const CJ_CLICK_HOST = 'https://www.kqzyfj.com';

// The booking link to use for a stay: Booking.com pages through CJ, any other
// site's page unchanged.
export function affiliateLink(site, url) {
  if (!url || site !== 'Booking.com') return url;
  return `${CJ_CLICK_HOST}/click-${CJ_PID}-${CJ_BOOKING_LINK_ID}?url=${encodeURIComponent(url.split('?')[0])}`;
}
