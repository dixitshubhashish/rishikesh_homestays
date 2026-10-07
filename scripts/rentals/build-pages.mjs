#!/usr/bin/env node
// Bike, car and taxi rental pages: /bike-rental-in-rishikesh, /car-rental-in-haridwar, … (3 kinds × 2 cities).
//
// One config (RENTALS below) and one template: the hand-made hub page
// bike-and-taxi-rental-in-rishikesh.html. Its <!--rent:name-->…<!--/rent:name--> regions are the parts that
// change per page; every other line (header, form, footer, sidebar) is copied as it is. Each page is a real
// file at the root because Vercel's clean URLs only map /x to x.html at the same path (CLAUDE.md "Pages and URLs").
//
//   node scripts/rentals/build-pages.mjs        writes the six pages, refreshes the hub's "related" links
//
// After running: node scripts/i18n/snippet.mjs is not needed (the head is the hub's); run `npm run i18n:extract`
// (the new pages are in PAGES of scripts/i18n/extract.mjs), then the sync steps of docs/I18N.md, and
// node scripts/py.mjs scripts/stays/footer_links.py (the footer finds these pages by file name: FAMILIES there)
//
// Copy rules (docs/HANDOFF.md): guide voice, no invented facts, no dates, no "official". The ₹700 line exists for
// Rishikesh bikes only (the owner's own figure); Haridwar pages promise no price.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = "https://rishikeshhomestays.com";
const HUB = "bike-and-taxi-rental-in-rishikesh";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonText = (s) => s.replace(/&amp;/g, "&");

export const CITIES = { rishikesh: "Rishikesh", haridwar: "Haridwar" };
export const KINDS = { bike: "Bike", car: "Car", taxi: "Taxi" };
export const slugOf = (kind, city) => `${kind}-rental-in-${city}`;

// ---- per-city text that replaces a region of the hub (Rishikesh keeps the hub's own text) --------------------
const HARIDWAR = {
  bikeIntro: `<h2>Bike &amp; scooty rental in Haridwar</h2>
            <p>Two wheels slip through where cars crawl: Haridwar jams solid around the evening aarti and the big snan days, and the ghats, Mansa Devi and Chandi Devi sit far enough apart to make walking tiring. Tell us the days you need a scooty or a bike and we arrange it with trusted local partners; the price depends on the bike, the season and how many days you keep it, and we confirm it before anything is booked.</p>`,
  traffic: `<li><strong>Traffic:</strong> the roads around Har Ki Pauri and the railway station get packed on aarti evenings, weekends and snan days. Ride slow, honk at blind corners, and park where the locals park instead of at the ghat itself.</li>`,
  ridesHead: `<h2>Ride ideas from Haridwar</h2>`,
  rides: `<article class="info-card"><h3>Har Ki Pauri &amp; the ghats</h3><p>The heart of town. Go early in the morning, or after the aarti crowd thins, and walk the last stretch.</p></article>
              <article class="info-card"><h3>Mansa Devi</h3><p>The hill temple above the town. Ride to the base, then take the ropeway or climb.</p></article>
              <article class="info-card"><h3>Chandi Devi</h3><p>The hill temple across the Ganga on Neel Parvat, with the town spread out below.</p></article>
              <article class="info-card"><h3>Rishikesh</h3><p>About 25 km up the Ganga road. An easy morning run to Laxman Jhula and Tapovan.</p></article>`,
  cabCards: `<article class="info-card"><h3>Local sightseeing</h3><p>Har Ki Pauri, Mansa Devi, Chandi Devi and the ashrams in one day, with a driver who waits while you explore.</p></article>
              <article class="info-card"><h3>Airport &amp; station pickups</h3><p>Haridwar railway station and Jolly Grant airport (Dehradun), timed to your train or flight.</p></article>
              <article class="info-card"><h3>Rishikesh transfers</h3><p>One-way or return trips to Rishikesh, Laxman Jhula and Tapovan.</p></article>
              <article class="info-card"><h3>Outstation</h3><p>Kedarnath, Badrinath and the Char Dham, Mussoorie, Dehradun and Delhi. Planning the yatra? Start with our <a href="/kedarnath-yatra">Kedarnath Yatra guide</a>.</p></article>`,
};

// ---- the six pages ---------------------------------------------------------------------------------------------
const PAGE = {
  "bike/rishikesh": {
    title: "Bike Rental in Rishikesh | Scooty, 150cc and Royal Enfield",
    description: "Rent a scooty, 150cc bike or Royal Enfield in Rishikesh (starting ₹700 onwards per day). Tell us your days and we arrange it with trusted local partners and quote on WhatsApp.",
    ogDescription: "Scooty, bike and Royal Enfield rentals in Rishikesh, starting ₹700 onwards per day, arranged with trusted local partners.",
    eyebrow: "Bikes &amp; scooties",
    h1: "Bike rental in Rishikesh, sorted over one chai.",
    hero: "Rent a scooty, a 150cc bike or a Royal Enfield. Tell us the days you need it and we arrange it with trusted local partners, so you skip the haggling at the rental shop.",
    leadH2: "Wheels for Rishikesh, minus the guesswork",
    lead: "Rishikesh is a town of steep lanes, river bridges and temples up winding hill roads. A scooty gets you to Tapovan cafes and Neelkanth on your own clock.",
    price: true,
  },
  "bike/haridwar": {
    title: "Bike Rental in Haridwar | Scooty and Bikes",
    description: "Rent a scooty or a bike in Haridwar for Har Ki Pauri, Mansa Devi, Chandi Devi and the run up to Rishikesh. Tell us your days and we arrange it with trusted local partners.",
    ogDescription: "Scooty and bike rentals in Haridwar, arranged with trusted local partners. Tell us your days and we quote.",
    eyebrow: "Bikes &amp; scooties",
    h1: "Bike rental in Haridwar, sorted over one chai.",
    hero: "Rent a scooty or a bike for the ghats, the hill temples and the road to Rishikesh. Tell us the days you need it and we arrange it with trusted local partners.",
    leadH2: "Wheels for Haridwar, minus the guesswork",
    lead: "Haridwar is a town of ghats, crowded bazaars and hill temples on both sides of the Ganga. Two wheels get you between them on your own clock.",
    pickup: "Har Ki Pauri, station, hotel...",
  },
  "car/rishikesh": {
    title: "Car Rental in Rishikesh | Self-Drive Cars",
    description: "Rent a self-drive car in Rishikesh for the hills, Haridwar and day trips. Tell us your dates and the car you want and we arrange it with trusted local partners and quote.",
    ogDescription: "Self-drive car rental in Rishikesh, arranged with trusted local partners.",
    eyebrow: "Self-drive cars",
    h1: "Car rental in Rishikesh, keys in your hand.",
    hero: "Rent a self-drive car and take the hill roads at your own pace. Tell us the dates and the car you want and we arrange it with trusted local partners.",
    leadH2: "A car for Rishikesh, minus the guesswork",
    lead: "A self-drive car lets you stop wherever the view does, from Neelkanth to the Haridwar ghats.",
  },
  "car/haridwar": {
    title: "Car Rental in Haridwar | Self-Drive Cars",
    description: "Rent a self-drive car in Haridwar for Rishikesh, the hills and day trips. Tell us your dates and the car you want and we arrange it with trusted local partners and quote.",
    ogDescription: "Self-drive car rental in Haridwar, arranged with trusted local partners.",
    eyebrow: "Self-drive cars",
    h1: "Car rental in Haridwar, keys in your hand.",
    hero: "Rent a self-drive car for Rishikesh, the hills and day trips. Tell us the dates and the car you want and we arrange it with trusted local partners.",
    leadH2: "A car for Haridwar, minus the guesswork",
    lead: "A self-drive car lets you stop wherever the view does, from Har Ki Pauri to Rishikesh and the hills.",
    pickup: "Har Ki Pauri, station, hotel...",
  },
  "taxi/rishikesh": {
    title: "Taxi Rental in Rishikesh | Local, Airport and Outstation Cabs",
    description: "Book a taxi in Rishikesh for local sightseeing, Jolly Grant airport and railway pickups, Haridwar and Kedarnath. Drivers who know the hill roads. Tell us your plan and we quote.",
    ogDescription: "Local, airport and outstation taxis in Rishikesh, arranged with trusted local partners.",
    eyebrow: "Taxis &amp; cabs",
    h1: "Taxi rental in Rishikesh, from the airport to the hills.",
    hero: "Local sightseeing, airport and railway pickups, Haridwar transfers and outstation trips with drivers who know the hill roads. Tell us your plan and we quote.",
    leadH2: "A cab for Rishikesh, minus the guesswork",
    lead: "A cab with a driver who knows the ghats gets you from Jolly Grant to your homestay without a single wrong turn, and on to Kedarnath when you are ready.",
  },
  "taxi/haridwar": {
    title: "Taxi Rental in Haridwar | Local, Station and Outstation Cabs",
    description: "Book a taxi in Haridwar for local sightseeing, railway station and Jolly Grant airport pickups, Rishikesh and Kedarnath. Drivers who know the hill roads. Tell us your plan and we quote.",
    ogDescription: "Local, station and outstation taxis in Haridwar, arranged with trusted local partners.",
    eyebrow: "Taxis &amp; cabs",
    h1: "Taxi rental in Haridwar, from the station to the hills.",
    hero: "Local sightseeing, railway station and airport pickups, Rishikesh transfers and outstation trips with drivers who know the hill roads. Tell us your plan and we quote.",
    leadH2: "A cab for Haridwar, minus the guesswork",
    lead: "A cab with a driver who knows the town gets you from the railway station to Har Ki Pauri and on to the hills without a wrong turn.",
    pickup: "Har Ki Pauri, station, hotel...",
  },
};

export const RENTALS = Object.entries(PAGE).map(([key, cfg]) => {
  const [kind, city] = key.split("/");
  return { kind, city, slug: slugOf(kind, city), url: `/${slugOf(kind, city)}`, ...cfg };
});

// "How it works": the first and last step name this kind; the two between are the hub's.
const HOW = {
  bike: ["Tell us the bike or scooty you want and the days.", "Pick up the keys and go."],
  car: ["Tell us the car you want, the dates and where you will pick it up.", "Pick up the keys and go."],
  taxi: ["Tell us the trip: local sightseeing, a pickup or an outstation route.", "Meet your driver and go."],
};
// The form's "What do you need?" options: only this kind's.
const OPTIONS = {
  bike: [["bike", "Bike / Scooty"]],
  car: [["self_drive", "Self-drive car"]],
  taxi: [["taxi_local", "Taxi – local"], ["taxi_pickup", "Taxi – airport/railway pickup"], ["taxi_outstation", "Taxi – outstation"]],
};
// The car page's own section (the hub only has a card and a FAQ for self-drive).
const carSection = (city) => `<h2>Self-drive car rental in ${city}</h2>
            <p>Self-drive cars are available on request, depending on dates. Tell us the dates, the kind of car you want and where you will pick it up, and we check with trusted local partners and send you a quote. No payment is needed to enquire.</p>
            <div class="info-grid">
              <article class="info-card"><h3>Licence and ID</h3><p>A valid car driving licence and an original photo ID. Visitors from outside India should bring an International Driving Permit along with their home licence.</p></article>
              <article class="info-card"><h3>Security deposit</h3><p>There is usually a refundable deposit, and it varies by car and partner. We will tell you the amount with the quote.</p></article>
              <article class="info-card"><h3>Hill roads</h3><p>The roads out of ${city} climb fast and narrow down quickly. Drive slow, keep clear of trucks on the bends, and plan to be back before nightfall.</p></article>
              <article class="info-card"><h3>Check the car</h3><p>Brakes, lights, tyres and the spare before you leave, and a quick photo of any scratches saves arguments later.</p></article>
            </div>
            <p>Would rather have someone else drive? See our <a href="/taxi-rental-in-${city.toLowerCase()}">taxi rental in ${city}</a>.</p>`;

// ---- FAQ (a page's questions: the kinds a question applies to; Rishikesh keeps the hub's wording) ---------------
const faqFor = ({ kind, city }) => {
  const R = city === "rishikesh";
  const list = [];
  if (kind === "bike") {
    list.push(R
      ? ["How much does a bike or scooty rental cost in Rishikesh?", "Bike and scooty rentals are starting ₹700 onwards per day. The final price depends on the bike, the season and how many days you keep it, and we confirm it with you before anything is booked."]
      : ["How does bike or scooty rental work in Haridwar?", "Tell us the dates and the kind of bike. We check with trusted local partners and send you the options and a price on WhatsApp or a call, and nothing is booked until you confirm."]);
    list.push(["What do I need to rent a bike or scooty?", "A valid two-wheeler driving licence and an original photo ID. Visitors from outside India should carry an International Driving Permit along with their home licence. Most partners also take a refundable security deposit, which varies by bike. Helmets are a must for rider and pillion, so ask for two."]);
  } else if (kind === "car") {
    list.push([`Can I rent a self-drive car in ${CITIES[city]}?`, "Self-drive cars are available on request, depending on dates. You will need a valid car driving licence and ID, and there is usually a security deposit. Tell us the dates and the kind of car you want."]);
    list.push(["Can I get a car with a driver instead?", `Yes, that is our taxi rental in ${CITIES[city]}: local sightseeing, pickups and outstation trips with a driver who knows the roads.`]);
  } else {
    list.push(R
      ? ["Can you arrange a pickup from Jolly Grant airport or the railway station?", "Yes. We arrange cabs from Jolly Grant airport (Dehradun), Yog Nagari Rishikesh and Haridwar railway stations, and the Rishikesh ISBT. Send your flight or train details, the number of people and bags, and we will quote."]
      : ["Can you arrange a pickup from Haridwar railway station or Jolly Grant airport?", "Yes. We arrange cabs from Haridwar railway station and Jolly Grant airport (Dehradun). Send your train or flight details, the number of people and bags, and we will quote."]);
    list.push(["Do you arrange taxis for Kedarnath and the Char Dham?", "Yes, outstation cabs with drivers who know the hill roads, for Kedarnath, Badrinath, the full Char Dham circuit, Mussoorie, Delhi and more. Tell us your route, dates and group size and we will put together a quote."]);
  }
  const thing = { bike: "bike", car: "car", taxi: "cab" }[kind];
  list.push([`Do I need to stay with you to book a ${thing}?`, `No, anyone can enquire. If you are staying at one of our homestays, we can line the ${thing} up for your arrival, so it is waiting when you are.`]);
  return list;
};

// ---- helpers -----------------------------------------------------------------------------------------------------
const region = (html, name) => {
  const open = `<!--rent:${name}-->`, close = `<!--/rent:${name}-->`;
  const i = html.indexOf(open), j = html.indexOf(close);
  if (i < 0 || j < i) throw new Error(`hub has no <!--rent:${name}--> region`);
  return { i, j, inner: html.slice(i + open.length, j), end: j + close.length };
};
// Replaces a region's content; `keep` leaves the markers (the hub), otherwise they go.
const setRegion = (html, name, inner, keep = false) => {
  const r = region(html, name);
  return html.slice(0, r.i) + (keep ? `<!--rent:${name}-->${inner}<!--/rent:${name}-->` : inner) + html.slice(r.end);
};
const dropRegion = (html, name) => setRegion(html, name, "");
const stripMarkers = (html) => html.replace(/<!--\/?rent:[a-z-]+-->/g, "");

const ldScript = (obj) => `<script type="application/ld+json">\n    ${JSON.stringify(obj, null, 2).replace(/\n/g, "\n    ")}\n    </script>`;
const replaceLd = (html, type, obj) => html.replace(/<script type="application\/ld\+json">[^]*?<\/script>/g, (block) => (block.includes(`"@type": "${type}"`) ? ldScript(obj) : block));

function relatedLinks(selfSlug) {
  const label = (r) => `${KINDS[r.kind]} rental in ${CITIES[r.city]}`;
  const links = RENTALS.filter((r) => r.slug !== selfSlug).map((r) => `<a href="${r.url}">${label(r)}</a>`);
  if (selfSlug !== HUB) links.unshift(`<a href="/${HUB}">Bike &amp; Taxi Rental in Rishikesh</a>`);
  return `<h2>More rentals</h2>\n            ${links.join("\n            ")}`;
}

// The switch: the three kinds for this city, then the two cities for this kind (plain links: every page stays a
// real, crawlable page; the template is the same).
function switchNav(r) {
  const tab = (href, text, on) => `<a href="${href}"${on ? ' aria-current="page"' : ""}>${text}</a>`;
  const kinds = Object.entries(KINDS).map(([k, label]) => tab(`/${slugOf(k, r.city)}`, label, k === r.kind)).join("");
  const cities = Object.entries(CITIES).map(([c, label]) => tab(`/${slugOf(r.kind, c)}`, label, c === r.city)).join("");
  return `<nav class="rental-switch" aria-label="Rental type and city"><div class="rental-switch-group">${kinds}</div><div class="rental-switch-group">${cities}</div></nav>`;
}
// The hub shows no page as current: the three kinds for Rishikesh.
const hubSwitch = () => `<nav class="rental-switch" aria-label="Rental type"><div class="rental-switch-group">${Object.entries(KINDS).map(([k, label]) => `<a href="/${slugOf(k, "rishikesh")}">${label}</a>`).join("")}</div></nav>`;

// ---- one page -----------------------------------------------------------------------------------------------------
export function buildPage(hub, r) {
  const city = CITIES[r.city], R = r.city === "rishikesh", url = `${SITE}${r.url}`, hubUrl = `${SITE}/${HUB}`;
  let h = hub;

  // head: title, description, canonical and social tags
  const headEnd = h.indexOf("</head>");
  let head = h.slice(0, headEnd).split(hubUrl).join(url);
  head = head.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(r.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => `${a}${esc(r.description)}${b}`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (_, a, b) => `${a}${esc(r.title)}${b}`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (_, a, b) => `${a}${esc(r.ogDescription)}${b}`);
  h = head + h.slice(headEnd);

  // schema: breadcrumb, service, faq (the hub's own are for the combined page)
  const name = `${KINDS[r.kind]} Rental in ${city}`;
  const faq = faqFor(r);
  h = replaceLd(h, "BreadcrumbList", {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` }, { "@type": "ListItem", position: 2, name, item: url }],
  });
  const serviceType = { bike: ["Bike rental", "Scooty rental"], car: ["Car rental", "Self-drive car rental", "Car with driver"], taxi: ["Taxi service", "Airport transfer", "Outstation taxi"] }[r.kind];
  h = replaceLd(h, "Service", {
    "@context": "https://schema.org", "@type": "Service", name, serviceType, url,
    image: `${SITE}/assets/images/rentals/${r.kind === "bike" ? "bike-rental-hero" : "tempo-traveller-hill-road"}.webp`,
    areaServed: [{ "@type": "City", name: city }],
    provider: { "@type": "Organization", name: "Rishikesh Homestays", url: `${SITE}/`, telephone: "+91-9027212484", email: "hello@rishikeshhomestays.com" },
    ...(r.price ? { offers: { "@type": "Offer", name: "Bike / scooty rental", priceCurrency: "INR", priceSpecification: { "@type": "UnitPriceSpecification", minPrice: 700, priceCurrency: "INR", unitText: "per day" } } } : {}),
  });
  h = replaceLd(h, "FAQPage", {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  });

  // car and taxi pages: the road photo with the van, not the motorbike (there is no car photo yet)
  if (r.kind !== "bike") {
    h = h.replace('<section class="page-hero rentals">', '<section class="page-hero rentals rentals-cab">');
    h = h.split("/assets/images/rentals/bike-rental-hero.webp").join("/assets/images/rentals/tempo-traveller-hill-road.webp");
  }

  // hero and lead
  h = setRegion(h, "hero-head", `<p class="eyebrow">${r.eyebrow}</p>\n          <h1>${r.h1}</h1>`);
  h = setRegion(h, "hero-text", `<p>${r.hero}</p>`);
  h = setRegion(h, "lead", `<h2>${r.leadH2}</h2>
            <p class="lead">${r.lead}</p>${r.price ? `
            <p class="rental-price"><strong>Starting ₹700 onwards</strong> <span>per day for bikes &amp; scooties</span></p>` : ""}`);

  const lis = h.match(/<!--rent:how-->[^]*?<\/ul><!--\/rent:how-->/)[0].match(/<li>[^]*?<\/li>/g);
  h = setRegion(h, "how", `<ul class="check-list">\n              <li>${HOW[r.kind][0]}</li>\n              ${lis[1]}\n              ${lis[2]}\n              <li>${HOW[r.kind][1]}</li>\n            </ul>`);
  h = setRegion(h, "switch", switchNav(r));
  h = setRegion(h, "options", OPTIONS[r.kind].map(([v, l], i) => `<option value="${v}"${i === 0 ? " selected" : ""}>${l}</option>`).join("\n                "));

  // which sections this kind shows, and the city's own text where the hub's is Rishikesh's
  if (r.kind === "bike") {
    h = dropRegion(h, "cab");
    if (!R) {
      h = setRegion(h, "bike-intro", HARIDWAR.bikeIntro);
      h = setRegion(h, "traffic", HARIDWAR.traffic);
      h = setRegion(h, "rides-head", HARIDWAR.ridesHead);
      h = setRegion(h, "rides", HARIDWAR.rides);
    }
  } else if (r.kind === "car") {
    h = dropRegion(h, "bike");
    h = setRegion(h, "cab", carSection(city));
  } else {
    h = dropRegion(h, "bike");
    h = setRegion(h, "cab-intro", "<p>Hand the wheel to someone who knows the roads. We book cars with drivers through trusted local partners, from small hatchbacks for a couple to SUVs and tempo travellers for families and groups.</p>");
    if (!R) h = setRegion(h, "cab-cards", HARIDWAR.cabCards);
    h = dropRegion(h, "selfdrive");
    h = h.replace("<h2>Taxi &amp; cab bookings</h2>", `<h2>Taxi &amp; cab bookings in ${city}</h2>`);
  }
  h = setRegion(h, "faq", faq.map(([q, a]) => `<details class="sx-faq-item">
              <summary>${esc(q)}</summary>
              <p>${esc(a)}</p>
            </details>`).join("\n            "));
  h = h.replace("<h2>Bike &amp; taxi rental FAQ</h2>", `<h2>${KINDS[r.kind]} rental FAQ</h2>`);
  if (r.kind !== "bike") h = setRegion(h, "cta", `<h2>Need a room for the trip too?</h2>\n              <p>Our handpicked homestays near the Ganga, Tapovan and Triveni Ghat come with hosts who can have your ${r.kind === "car" ? "car" : "cab"} waiting when you arrive.</p>`);
  h = setRegion(h, "related", relatedLinks(r.slug));

  // the form: the city and the pickup hint
  h = h.replace('<h2 id="rental-enquiry">Rental enquiry</h2>', `<h2 id="rental-enquiry">Rental enquiry</h2>\n            <input type="hidden" name="city" value="${city}">`);
  if (r.pickup) h = h.replace('placeholder="Tapovan, airport, station..."', `placeholder="${r.pickup}"`);
  return stripMarkers(h);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const hubFile = join(ROOT, `${HUB}.html`);
  const hub = readFileSync(hubFile, "utf8");
  for (const r of RENTALS) writeFileSync(join(ROOT, `${r.slug}.html`), buildPage(hub, r));
  // the hub lists all six (its own markers stay: this is the only part of it the script writes)
  const hubOut = setRegion(setRegion(hub, "related", relatedLinks(HUB), true), "switch", hubSwitch(), true);
  if (hubOut !== hub) writeFileSync(hubFile, hubOut);
  console.log(`rental pages: ${RENTALS.map((r) => r.slug).join(", ")}`);
}
