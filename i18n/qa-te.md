# Telugu (te) copy-edit QA

## What was checked
- I read every page side by side with `en.json`: all 1,035 unique strings (1,540 entries). I checked grammar, natural phrasing, meaning (with a back-translation of any line in doubt), tone and jokes, consistent terms, script, and protected content.
- Structure check after editing: every id from `en.json` is present, with none missing or extra. The `<n>…</n>` and `<n/>` tags have the same count and order as the English. Emails, phone numbers, ₹ amounts, Booking.com, WhatsApp and Airbnb are unchanged. `JSON.parse` loads the file without errors.
- Consistency check: the same English string has the same Telugu translation on every page. Edits were applied by English string, so this still holds.

## Overall verdict
The translation was already strong. It reads as natural Telugu and keeps the guide voice. Most jokes were already rewritten for Telugu readers instead of translated word by word ("అవి మాత్రం తిరిగి ఊపవు", "ఇక్కడ సందులదే పెత్తనం", "పట్టు వదలని చాయ్‌వాలాలు", "ఒక్క చాయ్ తాగేలోపు అంతా సెట్", "జ్ఞానోదయం అయిపోయి ఉండొచ్చు").

## Changes: 41 unique strings, 70 entries
- **Literal "plan around X"** came out as "X చుట్టూ ప్లాన్", which sounds machine-made (7 strings). It now reads "X‌కు తగ్గట్టు ప్లాన్", "కుంభ్ సమయంలో…", or "దాన్ని నమ్ముకుని ప్లాన్ వేసే ముందు" for the Haridwar spur, the bike rules and Valley of Flowers.
- **Wrong word choice:**
  - "List your homestay" was "జత చేయండి" (attach or pair). It is now "లిస్ట్ చేయండి" in the nav, footer and page title.
  - "minus the guesswork" was "ఊహాగానాలు" (a news-style word for speculation). It is now "తికమక లేకుండా".
  - "flexible base" was "సౌకర్యవంతమైన" (comfortable). It is now "మార్పులకు అనువుగా ఉండే".
  - "intentional mornings" was "ఉద్దేశపూర్వకమైన". It is now "మనసు పెట్టి గడిపే".
  - "Where the clusters are" was "గుమిగూడి" (used for crowds of people). It is now "కేఫ్‌లు ఎక్కువగా ఎక్కడ ఉన్నాయి?".
  - "short, honest bar" was "ప్రమాణాలు తక్కువే" (low standards). It is now "షరతులు కొన్నే, కానీ నిక్కచ్చిగా".
- **404 jokes sharpened:**
  - The Kumbh twin joke now ends with the page's name being called out on the lost-and-found tent's mic, which is what actually happens at the Mela: "…“తప్పిపోయినవారి శిబిరం” మైకులో దాని పేరు వినిపించింది".
  - Chotiwala's "just 5 minutes ahead" is now the classic local line: “ఇదిగో, ఇంకో 5 నిమిషాలే, ఆ మలుపు తిరిగితే అక్కడే”.
- **UI labels made idiomatic:**
  - Skip to content → "నేరుగా కంటెంట్‌కి వెళ్లండి"
  - Return home → "హోమ్ పేజీకి వెళ్లండి"
  - Start/End date → "ప్రారంభ / ముగింపు తేదీ"
  - Go live → "లైవ్ అవ్వండి"
  - Also listed on → "ఈ సైట్లలో కూడా ఉంది"
  - Goes via → "ఏ ఊళ్ల మీదుగా"
  - Helpful destinations (aria label) → "ఉపయోగపడే లింకులు"
  - Open to suggestions → "ఏదైనా సరే, మీరే సూచించండి"
  - Useful next steps → "తర్వాతి అడుగులు"
- **Smaller fixes:**
  - "Arrived! Now what?" was phrased as a question. It is now a statement: "చేరుకున్నారు!".
  - Kedarnath Day 3 now uses the imperative.
  - "Homely details" → "ఇంటి లాంటి హాయి".
  - Chotiwala "landmark" → "ల్యాండ్‌మార్క్".
  - "warm interior" → "హాయిగొలిపే".
  - "enquiry response target" → "ఎంక్వైరీకి సమాధానమిచ్చే గడువు".

## Kept on purpose (from the translator's notes)
- These stay in English: the brand "Rishikesh Homestays", stay and cafe names (Advaitam, Little Buddha Cafe, Chotiwala, Cheetal Grand…), Booking.com, Airbnb, MakeMyTrip, WhatsApp, Zomato, Swiggy, Blinkit, FASTag, Rajmargyatra and Royal Enfield, plus phone numbers, the email and ₹ prices.
- Place names are written in Telugu script (రిషికేశ్, హరిద్వార్, లక్ష్మణ్ ఝూలా, త్రివేణి ఘాట్, హర్ కీ పౌడీ…).
- The 2021 Kumbh figures use Indian units (91 లక్షల, 70 లక్షల). An automatic number check will flag these. That is expected.

## Still uncertain or worth a look on the live page
- The index hero stats are split strings ("24 గంటలు" + "ఎంక్వైరీకి సమాధానమిచ్చే గడువు", "స్థానిక" + "గైడ్ పేజీలు కూడా ఉన్నాయి"). They read fine as label pairs, but the line breaks should be checked when the page is rendered.
- The 404 lines "ఈ పేజీ" / "గంగలో మునక వేయడానికి వెళ్లి" / "ఇక తిరిగి రాలేదు." only make a sentence when shown in sequence. This is fine as long as the markup keeps them inline.
- "ఐచ్ఛికం" (Optional) is formal but common on Telugu forms. "(అవసరమైతేనే)" is a friendlier alternative if the owner prefers it.
