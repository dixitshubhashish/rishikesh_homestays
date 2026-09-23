// Builds the right WhatsApp deep link for the visitor's device.
//
// On mobile/tablet, wa.me opens the native WhatsApp app directly — one hop.
// On desktop, wa.me first shows an intermediate "Continue to Chat" landing
// page before redirecting to WhatsApp Web. Linking straight to
// web.whatsapp.com/send skips that hop: if the visitor already has WhatsApp
// Web open/logged in, the chat opens with the message pre-filled immediately.
// (No page can detect another origin's login state, so device type is the
// closest honest signal for which path is faster.)
export function isMobileDevice() {
  const ua = navigator.userAgent || navigator.vendor || '';
  return /android|iphone|ipad|ipod|windows phone/i.test(ua);
}

export function buildWhatsAppLink(phoneDigitsOnly, message) {
  const encoded = encodeURIComponent(message || '');
  const phone = String(phoneDigitsOnly || '').replace(/\D/g, '');

  return isMobileDevice()
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
}

// Rewrites every static wa.me link on the page (hero CTA, contact page
// button, etc.) to the device-appropriate link, preserving whatever phone
// number and pre-filled text each one already had.
export function enhanceStaticWhatsAppLinks() {
  document.querySelectorAll('a[href*="wa.me/"]').forEach((link) => {
    try {
      const url = new URL(link.href);
      const phone = url.pathname.replace(/^\/+/, '');
      const text = url.searchParams.get('text') || '';
      if (phone) {
        link.href = buildWhatsAppLink(phone, text);
      }
    } catch {
      // Malformed href — leave the original link untouched.
    }
  });
}
