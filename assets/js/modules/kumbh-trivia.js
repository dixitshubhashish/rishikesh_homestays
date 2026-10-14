// Footer "Kumbh Mela trivia" line, on every page (owner, 2026-10-14): one
// random fact about the four real Kumbh cities (Haridwar, Prayagraj, Ujjain,
// Nashik) per page load, always linking to our own Haridwar Kumbh 2027 guide
// (/haridwar-kumbh-2027) for internal-linking value ahead of the 2027 event.
// Mirrors partner-banner.js: one small init function, called from site.js,
// that fills a footer hook element found by a data attribute.

const KUMBH_URL = '/haridwar-kumbh-2027';

// Each item is one short, accurate sentence. Keep them simple and factual;
// every one links to KUMBH_URL, never a generic or external link.
const TRIVIA = [
  'Kumbh Mela rotates between four cities: Haridwar, Prayagraj, Ujjain and Nashik.',
  "Haridwar's Kumbh bathing happens at Har Ki Pauri, a ghat on the Ganga.",
  "Prayagraj's Kumbh is held at the Sangam, the meeting point of the Ganga, Yamuna and the unseen Saraswati.",
  'Ujjain hosts its Kumbh, called Simhastha, on the banks of the Kshipra river.',
  "Nashik's Kumbh is centred on the Godavari river near the Trimbakeshwar temple.",
  'Each of the four cities hosts a Kumbh roughly once every 12 years, staggered so one falls every few years somewhere in India.',
  "Haridwar's next Kumbh Mela is reported for 2027, about 25 km from Rishikesh.",
  'The main Kumbh bathing days are timed to specific planetary positions, not just a fixed calendar date.',
  'Akhara processions of sadhus, some Naga sadhus among them, are a defining sight at every Kumbh city.',
  'The 2021 Haridwar Kumbh, cut short by COVID-19, still recorded roughly 9.1 million visits.',
];

export function initKumbhTrivia() {
  const el = document.querySelector('[data-kumbh-trivia]');
  if (!el) return;
  const text = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
  const a = document.createElement('a');
  a.href = KUMBH_URL;
  a.textContent = text;
  el.textContent = '';
  el.appendChild(a);
}
