#!/usr/bin/env node
// Driving guides from every Delhi NCR city: driving-from-<city>-to-rishikesh and driving-from-<city>-to-haridwar.
//
// The master guide (hand-made, driving-from-delhi-to-rishikesh.html) covers Delhi to both towns in depth:
// tolls and FASTag, festival rush, food stops, parking. These pages are the per-city entry points: the
// distance, the route and the way out of the city, then a link to the master guide for the shared parts.
// Delhi to Rishikesh IS the master guide, so it is not generated; Delhi to Haridwar is.
//
//   node scripts/drives/build-pages.mjs    writes the pages and the master guide's "other starting points" links
//
// The head, header and footer are the master guide's; only <main>, the title and the structured data change.
// After running: node scripts/py.mjs scripts/stays/footer_links.py (the footer finds these pages by file name: FAMILIES there), then
// `npm run i18n:extract` (pages are listed in PAGES of scripts/i18n/extract.mjs via DRIVES), `npm run build:search`,
// `node scripts/py.mjs scripts/stays/page_dates.py`, then the sync steps of docs/I18N.md.
//
// Copy rules (docs/HANDOFF.md): guide voice, no invented facts. Distances are rounded to 10 km from several
// routing sources (they differ by 10-30 km depending on where in the city you start): always "about".
// Expressway facts (Akshardham start, Khekra junction with the Eastern Peripheral Expressway, opened 14 April
// 2026, five toll plazas) are the master guide's; the Haridwar spur status is "check before you go".

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = "https://rishikeshhomestays.com";
const MASTER = "driving-from-delhi-to-rishikesh";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const DESTS = { rishikesh: "Rishikesh", haridwar: "Haridwar", dehradun: "Dehradun", mussoorie: "Mussoorie" };
// km: [to Rishikesh, to Haridwar, to Dehradun, to Mussoorie], rounded to 10 km from several routing sources
// (Google Maps typical distance, cross-checked against a second source; they differ by 10-30 km depending on
// where in the city you start, hence "about"). Rishikesh, Dehradun and Mussoorie all go up the Delhi-Dehradun
// Expressway (fully open since 14 April 2026), so Dehradun is Rishikesh minus the last Doiwala/Jolly Grant
// stretch (about 20 km), and Mussoorie is Dehradun plus the Mussoorie Road climb (about 35 km, confirmed:
// Dehradun-Mussoorie is 33-35 km by road per trivenicabs/savaari). Haridwar is not on the expressway, so it
// keeps its own, separately-sourced figure. start/leave: the city's own text.
export const CITIES = {
  delhi: {
    name: "Delhi", km: [240, 215, 220, 260],
    start: "Delhi is big enough that your starting point matters: from east Delhi, Akshardham, where the Delhi–Dehradun Expressway begins, is a short hop, while from west and south Delhi the first hour goes on crossing the city.",
    startH: "Delhi is big enough that your starting point matters: for Haridwar you leave on the Delhi–Meerut Expressway, which is quickest from east Delhi, while west and south Delhi spend the first hour crossing the city.",
    // destination-agnostic (owner, 2026-10-08): this text is shared across all 4 destinations now, not just
    // the river towns, so it no longer names "the river" specifically
    leave: "Leave Delhi before 6 am: you clear the city before it wakes up and have the morning free once you arrive.",
  },
  gurugram: {
    name: "Gurugram", km: [270, 245, 250, 290],
    start: "Gurugram is on the far side of Delhi from the road north, so a good part of the first hour goes on crossing the city to Akshardham. The Eastern Peripheral Expressway lets you go around Delhi and meets the Delhi–Dehradun Expressway at Khekra near Baghpat; let live traffic decide which is quicker on the day.",
    startH: "Gurugram is on the far side of Delhi from the road to Haridwar, so expect the first hour to go on crossing the city towards the Delhi–Meerut Expressway in east Delhi. Let live traffic decide whether going around Delhi on the Eastern Peripheral Expressway is quicker on the day.",
    leave: "Leave Gurugram before 5:30 am if you can: the Delhi side of the drive is where the time disappears, and the roads out of the city fill up early.",
  },
  noida: {
    name: "Noida", km: [240, 215, 220, 260],
    start: "Noida is the closest big city to Akshardham, where the Delhi–Dehradun Expressway begins, so the expressway is the natural way out for Rishikesh.",
    startH: "From Noida, head for Ghaziabad and the Delhi–Meerut road; the old highway to Haridwar starts beyond Meerut.",
    leave: "Leave Noida before 6 am: the roads towards Delhi's eastern edge fill up with office traffic soon after.",
  },
  "greater-noida": {
    name: "Greater Noida", km: [255, 230, 240, 280],
    start: "Greater Noida is a little further from the expressway than Noida: head up through Noida to Akshardham, where the Delhi–Dehradun Expressway begins, and allow extra time for the Noida stretch.",
    startH: "From Greater Noida, head up through Noida towards Ghaziabad and the Delhi–Meerut road; the old highway to Haridwar starts beyond Meerut.",
    leave: "Leave Greater Noida before 6 am so you are through Noida before the morning traffic builds.",
  },
  ghaziabad: {
    name: "Ghaziabad", km: [215, 190, 200, 240],
    start: "Ghaziabad is already on the Delhi–Meerut road, so the old highway to Haridwar starts close to home. For Rishikesh you can follow that road and the old highway, or go back to Akshardham for the expressway.",
    startH: "Ghaziabad is already on the Delhi–Meerut road, so the old highway to Haridwar starts close to home.",
    leave: "Leave Ghaziabad before 6 am: the Meerut road and the Delhi border both clog early on weekdays and on Friday evenings.",
  },
  faridabad: {
    name: "Faridabad", km: [255, 230, 240, 280],
    start: "Faridabad is south of Delhi, so going north means crossing the city or going around it on the Eastern Peripheral Expressway, which meets the Delhi–Dehradun Expressway at Khekra near Baghpat. Check live traffic before you choose.",
    startH: "Faridabad is south of Delhi, so going north means crossing the city or going around it on the Eastern Peripheral Expressway. Check live traffic before you choose, then head for the Delhi–Meerut road and the old highway beyond Meerut.",
    leave: "Leave Faridabad before 5:30 am: the first stretch, whichever way you go around Delhi, is where early starts pay off.",
  },
  sonipat: {
    name: "Sonipat", km: [245, 220, 230, 270],
    start: "Sonipat is north-west of Delhi, so you can skip the city: the Eastern Peripheral Expressway starts at Kundli, in Sonipat district, and meets the Delhi–Dehradun Expressway at Khekra near Baghpat. Check live traffic before you choose.",
    startH: "Sonipat is north-west of Delhi, so you can skip the city: the Eastern Peripheral Expressway starts at Kundli, in Sonipat district. Check live traffic before you choose, then head for the Meerut road and the old highway beyond it.",
    leave: "Leave Sonipat before 6 am, ahead of the Delhi-bound morning traffic around Kundli.",
  },
  meerut: {
    name: "Meerut", km: [165, 140, 190, 230], oldOnly: true,
    start: "Meerut is on the old highway itself: from here it is straight up NH-334, still called NH-58 by everyone, through Muzaffarnagar and Roorkee to Haridwar.",
    leave: "Leave Meerut before 7 am: the old highway through Muzaffarnagar and Roorkee is slow once the day's traffic is out.",
  },
};

export const PAGES = Object.keys(CITIES).flatMap((city) => Object.keys(DESTS)
  .filter((dest) => !(city === "delhi" && dest === "rishikesh")) // the master guide
  .map((dest) => ({ city, dest, slug: `driving-from-${city}-to-${dest}`, url: `/driving-from-${city}-to-${dest}` })));
export const pageUrl = (city, dest) => (city === "delhi" && dest === "rishikesh" ? `/${MASTER}` : `/driving-from-${city}-to-${dest}`);

// "about 4 to 6 hours": the fastest clear run and the slow-day run, to the half hour
const half = (h) => Math.round(h * 2) / 2;
function hours(km, expressway) {
  const lo = half(km / (expressway ? 62 : 50)), hi = half(km / (expressway ? 40 : 38));
  return lo === hi ? `${lo} hours` : `${lo} to ${hi} hours`;
}

// The switch: "Planning to:" the two towns, "From city:" the cities. Plain links, so every page stays a real,
// crawlable page and the template is the same; the current town and city are marked.
export function switchHtml(city, dest) {
  const tab = (href, text, on) => `<a href="${href}"${on ? ' aria-current="page"' : ""}>${text}</a>`;
  const row = (label, tabs) => `<div class="rental-switch-row"><span class="rental-switch-label">${label}</span><div class="rental-switch-group">${tabs}</div></div>`;
  const destTabs = Object.entries(DESTS).map(([d, label]) => tab(pageUrl(city, d), label, d === dest)).join("");
  const cityTabs = Object.entries(CITIES).map(([k, v]) => tab(pageUrl(k, dest), v.name, k === city)).join("");
  return `<nav class="rental-switch drive-switch" aria-label="Destination and starting city">${row("Planning to:", destTabs)}${row("From city:", cityTabs)}</nav>`;
}

const DEST_INDEX = { rishikesh: 0, haridwar: 1, dehradun: 2, mussoorie: 3 };

function page(city, dest) {
  const c = CITIES[city], C = c.name, D = DESTS[dest];
  const R = dest === "rishikesh", H = dest === "haridwar", M = dest === "mussoorie";
  const km = c.km[DEST_INDEX[dest]];
  // Rishikesh, Dehradun and Mussoorie all leave the city the same way (the expressway route); only
  // Haridwar (not on the expressway) gets its own startH text, where a city has one.
  const start = !H || !c.startH ? c.start : c.startH;
  const exp = !H && !c.oldOnly;
  const time = hours(km, exp);
  const route = R
    ? (exp ? "Take the Delhi–Dehradun Expressway to the Dehradun end, then Doiwala and Jolly Grant down to Rishikesh."
      : "Take the old highway (NH-334) through Muzaffarnagar, Roorkee and Haridwar, then the 25 km run up the river to Rishikesh.")
    : H
    ? "Take the old highway (NH-334, still called NH-58) through Meerut, Muzaffarnagar and Roorkee."
    : dest === "dehradun"
    ? (exp ? "Take the Delhi–Dehradun Expressway all the way to Dehradun." : "Take the old highway (NH-334) through Muzaffarnagar and Roorkee, then the Haridwar–Dehradun road (NH-72) on to Dehradun.")
    : (exp ? "Take the Delhi–Dehradun Expressway to Dehradun, then climb Mussoorie Road, about 35 km, up to Mussoorie." : "Take the old highway (NH-334) through Muzaffarnagar and Roorkee, then the Haridwar–Dehradun road (NH-72) to Dehradun, then Mussoorie Road up the last 35 km.");
  const title = `Driving from ${C} to ${D} | Route, Time and Tips`;
  const desc = `Driving from ${C} to ${D}: about ${km} km by road, about ${time} on a clear run, the best route, when to leave and where to stay. Part of our Delhi NCR road-trip guides.`;
  const url = `${SITE}/driving-from-${city}-to-${dest}`;

  const faq = [
    [`How far is ${D} from ${C} by road?`, `It is about ${km} km by road, roughly ${time} depending on traffic and the route.`],
    [`Which route should I take from ${C} to ${D}?`, `${route} ${start.split(". ")[0].replace(/\.$/, "")}.`],
    [`When is the best time to leave for ${D}?`, "Before 6 am, and never on a Friday evening if you can help it. Avoid the last week of the Kanwar Yatra in the month of Sawan, roughly July to August, and the main Kumbh 2027 bathing days."],
  ];

  const ld = (o) => `<script type="application/ld+json">\n    ${JSON.stringify(o, null, 2).replace(/\n/g, "\n    ")}\n    </script>`;
  const jsonld = [
    ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Driving from Delhi to Rishikesh", item: `${SITE}/${MASTER}` },
      { "@type": "ListItem", position: 3, name: `Driving from ${C} to ${D}`, item: url }] }),
    ld({ "@context": "https://schema.org", "@type": "Article", headline: `Driving from ${C} to ${D}: route, time and tips`, description: desc,
      image: `${SITE}/assets/images/things-to-do/about-sacred-river.webp`, datePublished: "2026-10-06", dateModified: "2026-10-06", inLanguage: "en",
      mainEntityOfPage: url, author: { "@type": "Organization", name: "Rishikesh Homestays", url: `${SITE}/` },
      publisher: { "@type": "Organization", name: "Rishikesh Homestays", url: `${SITE}/`, logo: { "@type": "ImageObject", url: `${SITE}/assets/images/logo.png` } },
      about: [{ "@type": "Place", name: D }, { "@type": "Place", name: C }] }),
    ld({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }),
  ];

  const sw = switchHtml(city, dest);

  const stay = R
    ? `<h2>A calmer base you can actually drive to</h2>
            <p>Our own <a href="/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh">Advaitam Ganga &amp; Hill View homestay</a> is in Nirmal Bagh, a quieter pocket by the river, away from the Tapovan and Laxman Jhula lanes. You roll in, park right at the homestay and walk about 50 m to the ghat for the evening aarti. Send us your arrival time on <a href="https://wa.me/918050091290" target="_blank" rel="noopener">WhatsApp</a> and we will share the pin and where to park. Want something else? Compare <a href="/hotels/best-hotels-in-rishikesh">stays in Rishikesh</a>.</p>`
    : H
    ? `<h2>Where to stay</h2>
            <p>Compare <a href="/hotels/best-hotels-in-haridwar">stays in Haridwar</a>, or base yourself 25 km up the river in Rishikesh, which is calmer, especially around the big Kumbh days: our own <a href="/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh">Advaitam Ganga &amp; Hill View homestay</a> has easy parking and a short walk to the ghat. <a href="/contact">Tell us your dates</a> and we will suggest a few.</p>`
    : `<h2>Where to stay</h2>
            <p>Compare <a href="/hotels/best-hotels-in-${dest}">stays in ${D}</a>, or come down to Rishikesh by the river, about ${M ? "80" : "45"} km away: our own <a href="/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh">Advaitam Ganga &amp; Hill View homestay</a> has easy parking and a short walk to the ghat. <a href="/contact">Tell us your dates</a> and we will suggest a few.</p>`;

  const main = `<main>
      <section class="page-hero delhi-drive">
        <div class="page-hero-inner">
          <p class="eyebrow">Road trip guide</p>
          <h1>Driving from ${C} to ${D}.</h1>
          <p>${R ? `The road from ${C} to Rishikesh, in plain words: how far, which way, when to leave and where to park when you arrive.` : `The road from ${C} to ${D}, in plain words: how far, which way, when to leave and where to stay when you arrive.`}</p>
        </div>
      </section>

      <div class="container">${sw}</div>

      <section class="guide-section">
        <div class="container guide-grid">
          <article class="guide-copy">
            <section class="quick-facts" aria-labelledby="quick-facts-h">
              <h2 id="quick-facts-h">Quick facts: ${C} to ${D} by road</h2>
              <ul>
                <li>${C} to ${D} is about ${km} km by road.</li>
                <li>Plan on about ${time} on a clear run; traffic and the way out of ${C} decide the rest.</li>
                <li>${route}</li>
                <li>${c.leave}</li>${R ? `
                <li>Haridwar to Rishikesh is a 25 km drive up the river.</li>` : M ? `
                <li>Dehradun to Mussoorie is about 35 km up Mussoorie Road, roughly an hour.</li>` : ""}
              </ul>
            </section>

            <h2>Getting out of ${C}</h2>
            <p>${start}</p>

            <h2>The route</h2>
            <p>${route}${R && !c.oldOnly ? " Navigation apps sometimes send you towards Roorkee and Haridwar instead; let live traffic decide on the day." : ""}${H ? " A new link from the expressway to Haridwar's ring road is being built, so check whether it has opened before you plan around it." : ""}</p>
            <p>Tolls and FASTag, food stops, the Kanwar Yatra and Kumbh rush, and parking: all in our <a href="/${MASTER}">Delhi to Rishikesh and Haridwar driving guide</a>.</p>

            ${stay}

            <div class="rh-ad-slot" data-ad="article"></div>
            <section class="sx-faq" aria-labelledby="drive-faq-h">
              <h2 id="drive-faq-h">${C} to ${D} by road: questions travellers ask</h2>
              ${faq.map(([q, a]) => `<details class="sx-faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n              ")}
            </section>
          </article>
          <aside class="side-panel">
            <h2>Plan the drive and the stay</h2>
            <a href="/${MASTER}">Delhi to Rishikesh and Haridwar driving guide</a>
            <a href="/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh">Advaitam: easy-parking base by the Ganga</a>
            <a href="/hotels/best-hotels-in-${dest}">Compare stays in ${D}</a>
            <a href="/haridwar-kumbh-2027">Haridwar Kumbh 2027 guide</a>
            <a href="/bike-and-taxi-rental-in-rishikesh">Bike &amp; Taxi Rental</a>
            <a href="/contact">Send us your dates</a>
          </aside>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="cta-band">
            <div>
              <h2>Driving up this weekend?</h2>
              <p>Tell us your dates and group size. We will suggest a homestay with easy parking and send the pin on WhatsApp, so the last kilometre is the easiest one.</p>
            </div>
            <a class="btn btn-secondary" href="/contact">Plan my stay</a>
          </div>
        </div>
      </section>
    </main>`;
  return { title, desc, url, jsonld, main, faq };
}

// Builds a page from the master guide's head, header and footer.
export function buildPage(master, city, dest) {
  const p = page(city, dest);
  const masterUrl = `${SITE}/${MASTER}`;
  const headEnd = master.indexOf("</head>");
  let head = master.slice(0, headEnd).split(masterUrl).join(p.url);
  head = head.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(p.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => `${a}${esc(p.desc)}${b}`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (_, a, b) => `${a}${esc(p.title)}${b}`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (_, a, b) => `${a}${esc(p.desc)}${b}`);
  // the master's structured data (breadcrumb, article, FAQ) is replaced by this page's
  let n = 0;
  head = head.replace(/<script type="application\/ld\+json">[^]*?<\/script>/g, () => p.jsonld[n++] || "");
  const a = master.indexOf("<main>"), b = master.indexOf("</main>") + "</main>".length;
  return head + master.slice(headEnd, a) + p.main + master.slice(b);
}

// The master guide's "other starting points" list, between <!--drive:cities--> markers.
export function otherStarts() {
  const links = [];
  for (const [city, c] of Object.entries(CITIES)) for (const dest of Object.keys(DESTS)) {
    if (city === "delhi" && dest === "rishikesh") continue;
    links.push(`<a href="${pageUrl(city, dest)}">${c.name} to ${DESTS[dest]}</a>`);
  }
  return `<h2>Starting from elsewhere?</h2>\n            ${links.join("\n            ")}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = join(ROOT, `${MASTER}.html`);
  let master = readFileSync(file, "utf8");
  // the master keeps its own region up to date (this is the only part of it the script writes)
  for (const [name, html] of [["cities", otherStarts()], ["switch", switchHtml("delhi", "rishikesh")]]) {
    const open = `<!--drive:${name}-->`, close = `<!--/drive:${name}-->`;
    const i = master.indexOf(open), j = master.indexOf(close);
    if (i < 0 || j < i) throw new Error(`the master guide has no <!--drive:${name}--> region`);
    master = master.slice(0, i + open.length) + html + master.slice(j);
  }
  writeFileSync(file, master);
  for (const { city, dest, slug } of PAGES) writeFileSync(join(ROOT, `${slug}.html`), buildPage(master, city, dest));
  console.log(`driving pages: ${PAGES.length}`);
}
