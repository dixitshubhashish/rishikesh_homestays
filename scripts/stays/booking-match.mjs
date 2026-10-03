// The one rule both Booking.com checkers (verify_candidates.mjs and
// guess_booking_slugs.mjs) use to decide that a Booking property page is the
// same stay as ours: its title must name the stay and sit in the stay's city.
const STOP = new Set(('hotel hotels resort resorts rishikesh rishīkesh haridwar hardwar by the a an and of in at near on with stay stays ' +
  'homestay homestays home house guest guesthouse hostel apartment apartments villa inn lodge cottage cottages ' +
  'camp camps tapovan laxman jhula ram ganga ganges view river luxury premium boutique bhk 1bhk 2bhk 3bhk room rooms'
  + ' bedroom bedrooms bed beds flat flats studio studios peaceful cozy cosy private family deluxe budget spacious modern new entire unit penthouse duplex homely comfortable serene').split(' '));
export const words = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
export const distinctive = (name) => words(name).filter((w) => w.length > 2 && !STOP.has(w));
// generic words a Booking title may add to a name without making it another stay
const TITLE_OK = new Set('india uttarakhand suite suites villas homes hostels resorts dharamshala ashram'.split(' '));
// Booking titles read "<name>, <town> (updated prices…)". Each city only
// accepts its own towns, so a same-named hotel elsewhere never passes.
const CITY_WORDS = {
  rishikesh: /rish[iī]kesh|tapovan|lakshman|laxman|muni ki reti|shivpuri|narendra ?nagar|swarg|raiwala|byasi|kaudiyala|neelkanth|yamkeshwar|mohan ?chatti/i,
  haridwar: /har[iī]dw[aā]r|hardwar|kankhal|jwalapur|bhupatwala|bahadrabad|roorkee|motichur|raiwala/i,
};
const bhk = (s) => (s.toLowerCase().replace(/\s+/g, '').match(/(\d)bhk/) || [])[1];

// Is a Booking page with this final URL and title the stay called `name` in `city`?
export function bookingPageMatches(name, city, finalUrl, title) {
  if (!/booking\.com\/hotel\/[a-z]{2}\//.test(finalUrl) || /searchresults|\/city\//.test(finalUrl)) return false;
  return titleMatches(name, city, title);
}

// Does a property page title ("<name>, <town> …" on Booking; "<name> <town>:
// Reviews…" on EaseMyTrip, so pass nameEnd ':') name the stay in its city?
export function titleMatches(name, city, title, nameEnd = ',') {
  if (!(CITY_WORDS[city] || CITY_WORDS.rishikesh).test(title)) return false;
  const want = distinctive(name);
  const got = new Set(words(title));
  const hits = want.filter((w) => got.has(w)).length;
  // The title's own name part must not be mostly about something else:
  // "Aloha Ganges Apartments" is not "Aloha Serenity By Evara", and a "1 BHK"
  // listing is not the "2BHK" unit next door.
  const nameWords = new Set(words(name));
  const extra = distinctive(title.split(nameEnd)[0]).filter((w) => !nameWords.has(w) && !TITLE_OK.has(w));
  if (bhk(name) && bhk(title) && bhk(name) !== bhk(title)) return false;
  if (want.length >= 2) return hits / want.length >= 0.6 && extra.length <= hits;
  // One distinctive word ("7 Hills View Resort" → hills) is too easy to match
  // by accident ("Hotel KG Tapovan Hills"): then every word and number of the
  // name (minus generic words) must be in the title, and nothing new added.
  const strict = words(name).filter((w) => !STOP.has(w));
  return want.length === 1 && strict.length > 0 && strict.every((w) => got.has(w)) && extra.length === 0;
}
