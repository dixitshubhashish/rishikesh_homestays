// Google Analytics 4 (gtag.js), shared by every page. Each page includes it
// as the first thing after <meta charset>:
//   <script async src="/assets/js/analytics.js"></script>
// Change the measurement ID here, once, rather than in every HTML file.
// This is the site's only Google tag — don't also paste Google's gtag
// snippet (or a GTM container that fires GA4) into pages, or every page
// view gets counted twice.
const GA_MEASUREMENT_ID = 'G-L82BSZMRLW';

window.dataLayer = window.dataLayer || [];
window.gtag = function gtag() { window.dataLayer.push(arguments); };
window.gtag('js', new Date());
window.gtag('config', GA_MEASUREMENT_ID);

const tag = document.createElement('script');
tag.async = true;
tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
document.head.appendChild(tag);
