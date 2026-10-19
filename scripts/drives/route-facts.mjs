// Route facts for the generated driving guides (scripts/drives/build-pages.mjs, RH-BUG-13).
//
// Written from the research in the session scratchpad (high and medium confidence items only; low confidence
// dropped), paraphrased in the guide voice: no dates "as of", no sources, no toll or parking prices. Anything
// that changes (closures, rules) says to check the day's notice or live traffic. No fact here is invented:
// when the research was unsure (exact ramps, tunnel length, times from a given city) the text says so or leaves it out.
//
// ORIGIN_FACTS[city] = { ways: [...], bottlenecks: [...], avoid: [...] }   (Delhi has no research: no entry)
// DEST_FACTS[dest]   = { last: [...], restrictions: [...], parking: [...], timing: [...] }
// An item is { t: text, to?: [destinations it applies to] } (no `to` = every destination).
// Edit the texts here, run node scripts/drives/build-pages.mjs, then the i18n sync steps (docs/I18N.md).

const OLD = ["haridwar", "rishikesh"]; // the destinations people reach by the old Meerut–Muzaffarnagar–Roorkee road

export const ORIGIN_FACTS = {
  noida: {
    ways: [
      { t: "From Noida you reach Akshardham over the DND Flyway or through the Chilla border crossing. Both put you at the start of the Delhi–Dehradun Expressway." },
      { t: "The Delhi–Meerut Expressway starts from the same Akshardham junction, so the Meerut road and the Dehradun expressway share your first stretch out of Noida." },
      { t: "On the Delhi–Dehradun Expressway, the junction with the Eastern Peripheral Expressway at Khekra, near Baghpat, comes about 32 km after Akshardham. The road then runs on through Baraut, Shamli and Saharanpur.", to: ["rishikesh", "dehradun", "mussoorie"] },
      { t: "For Haridwar, the expressway's Haridwar spur leaves at Halgoya, near the 108 km mark, and ends at Bahadarabad on Haridwar's west ring road, where the highway towards Rishikesh begins. Check that the spur is open for your day before you plan around it.", to: ["haridwar"] },
    ],
    bottlenecks: [],
    avoid: [
      { t: "In the Kanwar Yatra weeks of Sawan, the Delhi–Haridwar highway and the Ganga canal road through Muzaffarnagar are shut to every vehicle for about a week, and Haridwar and Saharanpur traffic to Delhi is sent round by Deoband, Pachenda, Mirapur and Mawana." },
      { t: "Over the same weeks the Delhi–Meerut Expressway stops taking regular traffic in Ghaziabad, and cars and buses meet restrictions before that. The dates move every year, so read the Ghaziabad and Meerut police notice for your day before you go." },
    ],
  },
  "greater-noida": {
    ways: [
      { t: "Greater Noida's own link to Noida is the six-lane Noida–Greater Noida Expressway, about 24 km from Pari Chowk to the Mahamaya flyover. Run it to the Noida end, then carry on to Akshardham for the Delhi–Dehradun Expressway." },
      { t: "Pari Chowk is where the Yamuna Expressway meets a planned spur to the Ganga Expressway. The spur is still at the land stage and the Meerut–Haridwar extension has not been built, so neither is a way to Uttarakhand yet." },
      { t: "The Delhi–Dehradun Expressway is about 210 km in all, six lanes outside Delhi, and reaches the Eastern Peripheral Expressway at Khekra near Baghpat about 32 km after Akshardham.", to: ["rishikesh", "dehradun", "mussoorie"] },
      { t: "Haridwar has its own branch off that expressway: 50.7 km from Halgoya to Haridwar's west ring road, joining the Char Dham Highway towards Rishikesh. Ask whether it is open for your date.", to: ["haridwar"] },
      { t: "Mussoorie is reached through Dehradun. A raised road from Dehradun up to Mussoorie is only a proposal, so the climb still uses the ordinary Mussoorie Road.", to: ["mussoorie"] },
    ],
    bottlenecks: [],
    avoid: [
      { t: "At the peak of the Kanwar Yatra the Delhi–Haridwar highway through Muzaffarnagar is closed to all vehicles for several days, and Delhi–Haridwar traffic is sent round via Deoband and Mawana. Skip any plan that depends on it in July or August." },
      { t: "Heavy vehicles are stopped first, then cars and buses in Ghaziabad, and finally regular traffic on the Delhi–Meerut Expressway, which is left mostly to kanwariyas. Check the Ghaziabad and Meerut police advisory before a July or August trip." },
    ],
  },
  ghaziabad: {
    ways: [
      { t: "Ghaziabad sits on the Delhi–Meerut Expressway: 14 lanes, no signals, about 96 km up to Partapur on the Meerut bypass, with 100 km/h allowed on the Uttar Pradesh stretches and 70 km/h on the Delhi stretch." },
      { t: "At Partapur you meet NH-334. From there the old highway runs through Muzaffarnagar and Roorkee to Haridwar and on to Rishikesh.", to: OLD },
      { t: "The Delhi–Dehradun Expressway skips Meerut, Muzaffarnagar and Roorkee altogether: it runs from near Akshardham through Baghpat, Baraut, Shamli and Saharanpur. For Dehradun and Mussoorie it replaces the old road.", to: ["dehradun", "mussoorie"] },
      { t: "For Haridwar and Rishikesh the old NH-334 route is still the one most drivers trust; the expressway's Haridwar spur leaves at Halgoya, so check it is open before you rely on it.", to: OLD },
      { t: "Interchanges on the expressway, in order from Delhi, are Mandola Vihar, Khekra, Lohadda, Karaunda Mahajan, Karoda Hathi-Babri, Gogwan Jalalpur, Halgoya and Latifpur Aht. Pick the exit that matches your town and check it on a live map.", to: ["rishikesh", "dehradun", "mussoorie"] },
    ],
    bottlenecks: [
      { t: "The old Delhi–Meerut road used to take about two and a half hours, sometimes three. The expressway is meant to cut that to around 45 minutes, which takes the worst Ghaziabad–Meerut jam out of the day." },
    ],
    avoid: [
      { t: "Ghaziabad falls inside the Kanwar Yatra closures. Heavy vehicles are barred in the Meerut zone from late July, and for roughly a week in August every vehicle is kept off the Delhi–Haridwar highway, with only ambulances let through. Dates move with Sawan, so check the police notice for the year." },
      { t: "The Delhi–Meerut Expressway stops taking regular traffic a few days into that closure, and light vehicles and buses are held back before it. The busiest day falls around Sawan Shivratri." },
      { t: "This is a yearly pattern, not a one-off: earlier years saw heavy vehicles barred from late July and tight limits on both roads into early August. Plan on it every Sawan." },
      { t: "When the old road shuts, police point Delhi–Haridwar cars to the Delhi–Dehradun corridor and expect 25 to 30 per cent more traffic on it than usual. Kanwariyas are kept off it, but give yourself extra time." },
    ],
  },
  faridabad: {
    ways: [
      { t: "Faridabad lies on the Eastern Peripheral Expressway, a six-lane, 135 km ring road from Kundli in Sonipat to Dholagarh near Palwal. It lets you go around Delhi instead of through it." },
      { t: "The Eastern Peripheral Expressway meets the Delhi–Dehradun Expressway at Khekra, east of Baghpat. From Faridabad you travel round the east side by way of Dasna on NH-9 or Kot on NH-34 to reach that junction. The exact ramp to use from Faridabad is worth checking on a live map." },
      { t: "The Delhi–Dehradun Expressway is about 210 km: 32 km from Delhi to the junction, 118 km on to Saharanpur, 40 km to the Rajaji National Park edge and about 19.5 km into Dehradun. The 2.5-hour figure quoted for it is for Delhi, not Faridabad.", to: ["rishikesh", "dehradun", "mussoorie"] },
    ],
    bottlenecks: [],
    avoid: [
      { t: "At the Kanwar Yatra peak, NH-58 and the Ganga canal road in Muzaffarnagar are closed to every vehicle for about eight days, and the Delhi–Meerut Expressway stops taking regular traffic a few days into it. The days move each Sawan, so check them before you book." },
      { t: "Do not count on the older NH-58 road through Meerut and Muzaffarnagar while the yatra is on. It is the road the closures hit." },
    ],
  },
  gurugram: {
    ways: [
      { t: "The Dwarka Expressway, about 29 km from Shiv Murti to Kherki Daula, is the signal-free link between Gurugram and the Delhi side. Officials hoped for a 20 to 25 minute run end to end; treat that as a hope, not a promise." },
      { t: "The Delhi–Dehradun Expressway starts at Akshardham on the far side of Delhi. Its first 32 km are 12 lanes wide, up to the Khekra junction with the Eastern Peripheral Expressway east of Baghpat; it then continues to Saharanpur and Dehradun." },
      { t: "For Haridwar, a 50.7 km spur leaves the main expressway near the 108 km mark and ends at Haridwar's west ring road. One guide puts Delhi to Haridwar at about two hours on it, and Rishikesh roughly 20 km further on NH-58. Check that the spur is open before planning around it.", to: OLD },
      { t: "To reach the expressway through Delhi you first cross the border at Sirhaul, or pass IFFCO Chowk, Rajiv Chowk or Hero Honda Chowk. The Delhi–Gurugram Expressway between them is known for jams." },
    ],
    bottlenecks: [
      { t: "The Sirhaul border backs up again and again; one report has an hour passing between Shankar Chowk and the border. Traffic police blame lane-changing for most of the jams on the Delhi–Gurugram Expressway." },
      { t: "IFFCO Chowk, Hero Honda Chowk and Rajiv Chowk are among Gurugram's busiest junctions. Rain and waterlogging, notably at Hero Honda Chowk and on the Manesar–Rajiv Chowk stretch, have caused heavy morning jams." },
    ],
    avoid: [
      { t: "In the Kanwar Yatra weeks, NH-58 through Muzaffarnagar is shut to every vehicle for about a week and the Delhi–Meerut Expressway to regular traffic. Private cars heading from Delhi towards Haridwar and Dehradun are sent to the Delhi–Dehradun corridor, where peak days see 25 to 30 per cent more traffic. Dates move each year: read the district police notice for your day." },
    ],
  },
  sonipat: {
    ways: [
      { t: "Sonipat has the Eastern Peripheral Expressway on its doorstep: it begins at Kundli, where it meets NH-44, and runs 135 km down to Dholagarh near Palwal. It also has an interchange with NH-709B at Baghpat." },
      { t: "That expressway meets the Delhi–Dehradun Expressway at Khekra, east of Baghpat, so from Kundli you reach it without entering Delhi at all. The Kundli-to-Khekra distance and time are best read off a live map." },
      { t: "The Delhi–Dehradun Expressway itself is about 210 km. The quoted drive of about 2.5 hours is for the whole of it from Delhi, so from Sonipat you start part-way along it.", to: ["rishikesh", "dehradun", "mussoorie"] },
      { t: "Exits worth knowing are Khekra, Lohadda, Karaunda Mahajan, Gogwan Jalalpur, Halgoya (for the Saharanpur–Haridwar spur) and Latifpur Aht, the Saharanpur east bypass.", to: ["rishikesh", "haridwar", "dehradun", "mussoorie"] },
    ],
    bottlenecks: [],
    avoid: [
      { t: "For about a week during the Kanwar Yatra the Muzaffarnagar section of NH-58 and the Ganga canal road is closed to everything, and the Delhi–Meerut Expressway stops taking regular traffic a few days in. The yatra moves with Sawan, so check its dates before you book." },
      { t: "Keep off the older NH-58 road through Meerut and Muzaffarnagar while the yatra runs; that is the route being closed." },
    ],
  },
  meerut: {
    ways: [
      { t: "Meerut is on NH-334, the old NH-58 and now also signed NH-34. From the bypass it runs through Muzaffarnagar and Roorkee to Haridwar, then on to Rishikesh. The Delhi–Meerut Expressway ends at Partapur on the same bypass.", to: OLD },
      { t: "The Delhi–Dehradun Expressway passes Meerut by: it goes through Baghpat, Baraut, Shamli and Saharanpur, avoiding Muzaffarnagar and Roorkee as well. From Meerut you would have to head for it, so weigh that against going straight up NH-334.", to: ["dehradun", "mussoorie"] },
      { t: "Its interchanges from Delhi are Mandola Vihar, Khekra, Lohadda, Karaunda Mahajan (where it meets the Karnal–Meerut road), Karoda Hathi-Babri, Gogwan Jalalpur, Halgoya and Latifpur Aht. Pick the one nearest to you on a live map.", to: ["dehradun", "mussoorie"] },
    ],
    bottlenecks: [
      { t: "When NH-58 is shut for the Kanwar Yatra, traffic between Haridwar or Saharanpur and Delhi is sent through Deoband, Pachenda, Mirapur and Mawana, which means Meerut's own roads fill up too." },
    ],
    avoid: [
      { t: "The Meerut zone bars heavy vehicles from late July in the Kanwar Yatra, and for roughly a week in August the Delhi–Haridwar highway (NH-58, now NH-34 and NH-334) is closed to all traffic, with only ambulances exempt. Diversions run via Deoband, Pachenda, Mirapur and Mawana. Dates shift with Sawan, so read the Meerut traffic police notice for the year." },
      { t: "The Delhi–Meerut Expressway stops taking regular traffic a few days into that closure and is left mainly for Dak Kanwariyas, with light vehicles and buses held back first. The busiest day is around Sawan Shivratri." },
      { t: "This repeats every Sawan. Earlier years had heavy vehicles barred from late July and severe limits on NH-58 and the expressway into early August." },
      { t: "While the old road is shut, the police name the Delhi–Dehradun corridor as the alternative for Delhi–Haridwar travel and expect 25 to 30 per cent more traffic on it than usual. Kanwariyas may not use it." },
    ],
  },
};

export const DEST_FACTS = {
  rishikesh: {
    last: [
      { t: "From Dehradun the direct road to Rishikesh is NH-7 through Jolly Grant, where the airport is, and Doiwala. It is about 45 km, roughly one to one and a half hours." },
      { t: "Coming from Haridwar, the Dehradun road runs through Raiwala and Nepali Farm, where a fork leads off to Rishikesh." },
    ],
    restrictions: [
      { t: "Lakshman Jhula was closed to vehicles by the public works department some time ago, after a check on how much two-wheeler traffic the bridge could take; only a limited number of walkers cross. Do not plan to drive or ride over it, and ask your host about the current rule." },
    ],
    parking: [],
    timing: [],
  },
  haridwar: {
    last: [],
    restrictions: [
      { t: "At the peak of the Kanwar Yatra the highway through Muzaffarnagar is closed to every vehicle for several days, and traffic between Haridwar or Saharanpur and Delhi is sent round by Deoband, Pachenda, Mirapur and Mawana. Check the day's police notice before you set out." },
      { t: "The limits arrive in steps: heavy vehicles are stopped first, then all vehicles, with one side of the highway kept for kanwariyas. The pattern repeats each Sawan, so look at the yatra's dates for your year." },
    ],
    parking: [],
    timing: [],
  },
  dehradun: {
    last: [
      { t: "The expressway runs about 210 km from near Akshardham, six lanes wide, past the Saharanpur bypass and Ganeshpur before its final stretch into Dehradun." },
      { t: "The last stretch, called Daat Kali Tunnel–Dehradun, is about 20 km. It includes a raised wildlife corridor of roughly 12 km, underpasses for animals and the three-lane Datkali tunnel." },
      { t: "Reports put Delhi to Dehradun at about two and a half hours on the expressway, against more than six on the old road. Your own time depends on where in Delhi or the NCR you start." },
    ],
    restrictions: [
      { t: "Vehicles registered outside Uttarakhand pay a green cess to enter the state, collected without stopping at around eleven points. Rates and start dates have differed between reports, so confirm the current notice before you go." },
    ],
    parking: [],
    timing: [],
  },
  mussoorie: {
    last: [
      { t: "Dehradun to Mussoorie is about 35 km, one to one and a half hours. The road goes through Rajpur, after which it turns into hairpin bends all the way up." },
      { t: "On the climb you pass Kolhukhet, the Jharipani diversion and Kincraig, then reach one of Mussoorie's two main entrances." },
    ],
    restrictions: [
      { t: "Every tourist visiting Mussoorie must register online on the Dehradun Smart City portal. Police check the digital receipt at Kincraig and Picture Palace, by phone OTP for Indian visitors and email for foreign ones. Registration has been reported as free." },
      { t: "The Dehradun–Mussoorie road can close in the monsoon. After cloudbursts breached it in several places, about 2,500 tourists were stranded for two days, and the only other way is an 80 km detour via Vikasnagar against 35 km normally. Check the road's status before you leave." },
    ],
    parking: [
      { t: "On busy weekends the police may ask visitors to leave their cars at a designated parking and continue by local taxi. A multi-level car park for about 400 cars is described at Kincraig, roughly 2 km from town; capacity and rules change, so ask your host." },
    ],
    timing: [
      { t: "Weekends and the peak season jam hard. Gridlock has hit the Mussoorie–Dehradun road, the Kincraig–Library link, Motilal Nehru Road, Academy Road and Mall Road, and spread to Suwakholi, Buranskhanda and Dhanaulti. After more than 45,000 vehicles entered Dehradun on recent weekends, the police brought in a three-tier weekend diversion plan, with emergency vehicles exempt." },
    ],
  },
};
