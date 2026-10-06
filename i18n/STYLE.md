# House style per language

Each language's voice, glossary and the names that stay in Latin script. Translators (people or agents) read their language's section before translating; it wins over any general brief. How translation works and how to keep it in sync: `docs/I18N.md`.

Contents: [hi](#hi) · [bn](#bn) · [ta](#ta) · [te](#te) · [kn](#kn) · [mr](#mr) · [ne](#ne) · [si](#si) · [zh](#zh) · [es](#es) · [fr](#fr) · [pt](#pt) · [ru](#ru) · [de](#de) · [it](#it) · [ja](#ja) · [ko](#ko) · [id](#id) · [ms](#ms) · [tr](#tr) · [vi](#vi) · [he](#he)

## Hindi (hi) translation QA
<a id="hi"></a>

Scope: the 15 hand-made pages in `i18n/en.json`. That is 1,540 strings, 1,035 of them unique, about 12.5k English words. Every id has a Hindi string in `i18n/hi.json`. `node scripts/i18n/stale.mjs hi` reports 0 missing, 0 orphaned and 0 suspect: placeholders match, every English number is present and ₹ signs match.

### Method

1. I translated each unique string once into natural Hindi in a local guide's voice (Devanagari, आप form). Strings shared across pages, such as the header, footer and form labels, use the same id and so get the same Hindi everywhere.
2. In a separate pass I translated all 1,035 Hindi strings back into English, working only from the Hindi. I then compared each back-translation with the source English.
3. Every case of meaning drift was fixed in the Hindi and translated back again. The table below lists them. No drift is left.

### House style and glossary

- Place names are written as people in Rishikesh write them in Hindi: ऋषिकेश, हरिद्वार, गंगा (both "Ganga" and "Ganges"), तपोवन, त्रिवेणी घाट, स्वर्गाश्रम, मुनि की रेती, नीलकंठ रोड, लक्ष्मण झूला (both "Laxman" and "Lakshman"), राम झूला, जानकी सेतु, जानकी पुल, बजरंग सेतु, परमार्थ निकेतन, बीटल्स आश्रम, हर की पौड़ी, ब्रह्मकुंड, निर्मल बाग़, चीला, कुंजापुरी, एम्स (AIIMS), जॉली ग्रांट, योग नगरी ऋषिकेश, केदारनाथ, गौरीकुंड, सोनप्रयाग, गुप्तकाशी, बद्रीनाथ.
- These stay in Latin script as written: Rishikesh Homestays, Advaitam (Ganga & Hill View), WhatsApp, Airbnb, Booking.com, MakeMyTrip, FASTag, Rajmargyatra, UPI, ISBT, SUV, OTT, Royal Enfield, Himalayan (the bike), Zomato, Swiggy, Blinkit, Guest Favourite, White Album, The Beatles, and the cafe names (Little Buddha Cafe, Om Freedom Cafe, The 60's Cafe, Shambala Cafe, Devraj Coffee Corner, The Arches Cafe & Bakery, Ramana's Organic Cafe, Pure Soul Cafe & Organic Kitchen, Bistro Nirvana, Cheetal Grand). The one exception is Chotiwala, which is written चोटीवाला as on its own Hindi signboard.
- Common terms: area / locality = मोहल्ला (मोहल्ले, मोहल्लों; owner, 2026-10-06: never इलाका); homestay = होमस्टे; stay = ठहराव; enquiry = पूछताछ; shortlist = छोटी सूची; aarti = आरती; snan = स्नान; Amrit Snan = अमृत स्नान; tithi names use their Hindu calendar forms (मौनी अमावस्या, माघ पूर्णिमा, सोमवती अमावस्या…).
- Numbers use the digits 0–9 and stay exactly as in the English (₹670–675, ₹1,000, 3,583 मीटर, 14 अप्रैल 2026). Millions keep the English figure and add lakh in brackets: "9.1 मिलियन (91 लाख)".
- "Illustrative view of …" alt text becomes "… का चित्रण", which tells the reader it is an illustration and not a photo.
- Phone numbers, the email address, prices, URLs and the WhatsApp prefilled text never enter the catalogue, because the extractor skips href values and strings with no letters.

### Drift found in the back-translation pass and fixed

| id | English | First Hindi meant | Fixed Hindi now means |
|---|---|---|---|
| ca852c33dc23, 5c32e7041793 | List your homestay | Add your homestay | List your homestay (अपना होमस्टे लिस्ट करें) |
| 8a1d0f8c0f81 | List Your Homestay … \| Partner With Us | Add your homestay \| Join us | List your homestay \| Become our partner |
| cb7a6ce1eb64 | Featured Homestays | Special homestays | Featured homestays (फ़ीचर्ड होमस्टे) |
| f6eda3bbb552 | Get better, stay matches. | Get a better stay | Get better-matching stays |
| 5aa8bb0cf9e0 | … We covered you all | We will help with everything | We have every need of yours covered |
| c14635c12446, 8e11e4ad118b, 5cb82c012804 | traveller-friendly homestays | comfortable homestays for travellers | homestays suited to travellers (यात्रियों के अनुकूल) |
| d44d12c68c17 | A classic river crossing | An old river crossing | A well-known river crossing |
| fb8ebca76ead | A newer bridge attraction near the Rishikesh river corridor | A new bridge on the Ganga | A new bridge worth visiting near the riverside area |
| 9b384ed19237 | Food Styles to Try | Foods worth tasting | Food styles worth tasting |
| d00d9d84b28d | when your days have space | when your days have openness (awkward) | when your days have free time |
| 2e28c38e7ee1 | flexible pickup | pickup from anywhere | flexible pickup |
| 13813b014c66 | a meaningful stop | an important halt | a halt that means something |
| 6e9b065c6283 | one of the Ganga's headstreams | one of the Ganga's main streams | one of the Ganga's source streams |
| 7a69504840cc | acclimatise | adjust to the weather | adjust to the conditions |
| c50233487146 | nights are near freezing | nights are freezing cold | nights are almost freezing |
| 7dec334a9620 | traveller patterns | travellers' temperament | travellers' coming-and-going patterns |
| 0c0f1c604e5c | a spacious home | an open home | a big, roomy home |
| f4043715f38d, 99c5933b86f6 | Spacious lounge | Open lounge | Big, open lounge |
| ba5930c61089 | feels easy to settle into | feels like home on arrival | where settling in feels easy |
| 556757bf3d84 | Let Rishikesh shape the day | Let the day take Rishikesh's colours | Let the day shape itself to Rishikesh |
| 6 strings with "Context:" (things-to-do cards) | Context: | Special point: | Context: (संदर्भ:) |
| 24 strings with "Illustrative …" (alt text and one gallery button) | Illustrative view / scene | "symbolic picture" (सांकेतिक चित्र) | Illustration of … (चित्रण) |

### Checked and kept as they are (not drift)

- "Things to do" became घूमने-करने को ("things to see and do"). This is the usual Hindi nav label, with the same meaning.
- On the Kedarnath trail, "pony" became घोड़ा ("horse"). Signboards and pilgrims on the trail say घोड़ा-खच्चर, and पालकी stays पालकी.
- "Kedarnath temple opens/closes for the season" became कपाट खुलते/बंद होते ("the doors open/close"). This is the standard Hindi idiom for the same event.
- "Before 6 am is the magic hour" became सबसे बढ़िया समय ("the best time"). A literal "magic hour" sounds odd in Hindi, and the meaning is the same.
- The puns and jokes on the 404 page and the drive page ("they will not wave back", "the lanes will win", "the lanes have opinions") are kept as jokes with the same sense.
- The mantras ॐ नमः शिवाय and हर हर गंगे are already Hindi and stay the same.

### Notes on the English for the owner (Hindi follows the English as it is)

- On the contact page, "Get better, stay matches." and "airport pickups drops. We covered you all" read like typos in the English. The Hindi uses the meaning the owner most likely intended.
- The Advaitam page says "a genuine, independently run homestay". The stays-page copy rules avoid the word "independent". The Hindi translates the English faithfully (स्वतंत्र रूप से चलाया जाने वाला). If the English changes, `stale.mjs` will flag the string.
- "Official" appears in the English of the Kumbh, Kedarnath and Haridwar sentences about government notices and portals. The Hindi keeps आधिकारिक, because there the word is about the government, not about us.

### Keeping it current

- Run `node scripts/i18n/extract.mjs` after English edits, then `node scripts/i18n/stale.mjs hi`. Changed English shows up as `missing`, and its old translation as `orphan`. Translate the new ids, delete the orphans, and back-translate the new strings before they go live.
- `stale.mjs` is a warning tool. It always exits with code 0.

## Bengali (bn) QA review
<a id="bn"></a>

### What was checked
- I read all 15 pages side by side with en.json. That covers all 1,540 strings, or 1,035 unique ids. Shared ids such as the nav and footer were checked once. Every repeated id already had the same Bengali on every page.
- Grammar and naturalness. The text is standard colloquial Bangla (চলিত ভাষা) using আপনি. I back-translated any line I doubted.
- Tone. The jokes on the 404 page, the highway and parking quips, the "lanes" jokes and the cheeky disclaimers were each checked to see if they still land in Bangla.
- Things that must not change: tags, placeholders and entities (same count and order as en.json, checked with a script, 0 mismatches), ₹ amounts, phone numbers, the email address, brand and stay names, cafe names, and model codes (3BHK, 150cc, Classic 350, NH-334).
- Script. No Devanagari characters were found. The only Latin text left is brand, stay and cafe names and product terms (WhatsApp, FASTag, Wi-Fi, SUV, ISBT, OTT, UPI).
- The file is valid JSON with 15 pages and 1,540 strings, none missing and none empty.

### Changes: 89 ids, 135 strings across pages
- **Jokes rewritten so they work in Bangla** (they were too literal before):
  - "the lanes have opinions" was গলিগুলোর নিজস্ব মতামত আছে. It is now এখানে গলির মর্জিই শেষ কথা.
  - "the lanes will win" is now গলির সঙ্গে লড়াইয়ে আপনি হারবেনই.
  - "Half of Delhi has the same idea" is now অর্ধেক দিল্লির মাথায় তখন ঠিক আপনার বুদ্ধিটাই খেলছে.
  - "minus the guesswork" is now আন্দাজে ঢিল ছোড়া ছাড়াই.
  - "sorted over one chai" is now এক কাপ চা শেষ হওয়ার আগেই সব ব্যবস্থা.
  - The 404 Kumbh "separated twin" line now reads as the Bollywood cliché: কুম্ভমেলার ভিড়ে যমজ ভাইয়ের থেকে আলাদা হয়ে গেছে.
  - "Chotiwala is sure" is now হলফ করে বলছেন.
- **Awkward or word-for-word phrasing fixed:**
  - হোমে ফিরছি is now হোম পেজে ফিরে যাচ্ছি.
  - …হোমস্টে খুঁজুন ঋষিকেশে had broken word order. It now reads ঋষিকেশের … হোমস্টে খুঁজে নিন.
  - বজরং সেতু কাচের সেতু is now বজরং সেতু (কাচের সেতু).
  - সাইকেল সফরে একটা থামা যোগ করুন is now সাইকেল সফরে এখানে একবার থামুন.
  - নমনীয় একটা থাকার ঘাঁটি is now পরিকল্পনা বদলালেও চলে এমন ঘাঁটি.
  - Repeated words were removed in two lines: রাখুন…রাখুন and চিরাচরিত…চিরাচরিত.
  - The Kedarnath trek time line said সাধারণ…সাধারণত and had an unclear subject. Both are fixed.
  - The 2021 Kumbh sentence used a passive construction that read badly. It has been rewritten.
- **Meaning fixes:**
  - "Active" (Tapovan) had become সারাক্ষণ হইচই, which sounds negative. It is now প্রাণবন্ত.
  - "Riverine habitat" had become বাসস্থান. It is now নদীতীরের বনভূমি.
  - "Shared space" had become সাধারণ, which reads as "ordinary". It is now সবার ব্যবহারের.
  - "Faith and movement" is now বিশ্বাস আর জনস্রোত.
  - "Holi creates a natural long weekend" had used আপনিই, which reads as "you yourself". It is now আপনা থেকেই.
  - "Is pickup included" is now explicit.
- **Consistent terms:**
  - "Wellness" is now ওয়েলনেস everywhere. It had been সুস্থতা in some places.
  - "River activities" is now নদীর অ্যাডভেঞ্চার.
  - Two English loanwords were replaced with Bangla: "সাজেস্ট করব" is now বেছে দেব, and "কান্ট্রি কোড" is now দেশের কোড.
- **Short UI text** was made more idiomatic: বাছাই তালিকা চাই, লিস্টিং চালু, সঙ্গে পোষ্য আছে?, বন্ধুবান্ধব, থাকার জায়গা (for the "Stay" heading).
- **Digits:**
  - Changed to Bengali digits: © ২০২৬, ★৫.০, and the placeholder যেমন: ৩.
  - The <0>30</0> countdown on the 404 page stays in English digits because the script updates it.
  - ₹ prices stay in English digits, as before.
- **Stay name:** the bike page link label "Advaitam Ganga & Hill View 3BHK" is back in Latin script so the property name stays unchanged.

### Still uncertain
- "Plan my stay" (থাকার পরিকল্পনা) and "List your homestay" (আপনার হোমস্টে যোগ করুন) are clear but a little long for a nav bar. A native UX reviewer could shorten them.
- The ₹ figure followed by a Bengali comma in cb9237e69a54 and 39197f0524d9 is correct as written. The checker's earlier flag on these was a false positive.
- The Hindi chants are written in Bangla script (ওঁ নমঃ শিবায় / হর হর গঙ্গে). This is intentional.

## Tamil (ta) translation notes
<a id="ta"></a>

- 1,540 ids across 15 pages, all present; 1,035 unique English strings translated once and reused for repeated nav/footer strings.
- Kept in Latin script: brand and stay names (Rishikesh Homestays, Advaitam Ganga & Hill View, cafe names, Chotiwala, Cheetal Grand, Royal Enfield/Himalayan, Airbnb, Booking.com, MakeMyTrip, WhatsApp, Zomato, Swiggy, Blinkit, FASTag, Rajmargyatra, UPI), phone numbers, email, ₹ amounts.
- Place names in Tamil script as Tamil travel writing uses them: ரிஷிகேஷ், ஹரித்வார், லக்ஷ்மண் ஜூலா, ராம் ஜூலா, திரிவேணி காட், தபோவன், சுவர்க் ஆசிரமம், முனி கி ரேதி, நீலகண்ட், கேதார்நாத், எய்ம்ஸ் (AIIMS), கங்கை. "Ghat" as படித்துறை in running text, "காட்" inside proper names.
- Devanagari chants on 404 rendered as the Tamil forms ஓம் நமசிவாய / ஹர ஹர கங்கே (natural for Tamil readers).
- Jokes rewritten, not literal: 404 ("ஞானம் பெற்றுவிட்டதாக நம்பப்படுகிறது", "இருங்க, எனக்கு இங்கேயே பிடிச்சிருக்கு", old-cinema twins-separated-at-Kumbh), expressway elephants ("அவை திருப்பிக் கை அசைக்கப் போவதில்லை"), Haridwar spur ("எங்கள் வண்டியின் டயர் அதில் உருளும் நாளில்தான் நம்புவோம்"), parking ("சந்துகளுக்குச் சொந்தக் கருத்து உண்டு", "சந்துகளிடம் உங்கள் கார் தோற்றுவிடும்").
- Placeholder tags (<0>…</0>, <0/>) checked: same count and order as English in every string. Some Tamil word order puts the tag after a postposition-bearing noun (e.g. "<0>…வழிகாட்டியைப்</0> பாருங்கள்"), which is grammatical.
- Review candidates: 2021 Kumbh figures converted to lakh (91 லட்சம் / 70 லட்சம) for Indian readers; "Workation" kept as வொர்க்கேஷன் (common loanword).

---

# Copy-edit QA pass (native Tamil review)

### What was checked
- All 1,035 unique English strings (covering all 1,540 ids on 15 pages) were read side by side with the Tamil. Lines I was unsure of were back-translated.
- Checks covered grammar, natural phrasing, meaning, tone and jokes, consistent terms, script, and the items that must stay unchanged: names, ₹ amounts, phone numbers, email, `<0>…</0>` and `<0/>` tags.
- Automated checks after editing: `JSON.parse` passes. Pages and ids match `en.json` exactly (15 pages, 1,540 ids), with none empty. Tags are the same in every string, in count and order. Phone numbers, email and ₹ amounts match the English. There is no Devanagari outside the two 404 chants, which were already turned into Tamil script.

### Overall verdict
The translation was already strong. Sentences are natural and the guide voice comes through. The jokes work in Tamil: the 404 page, the elephants on the expressway, the Haridwar spur ("we'll believe it when our tyres touch it"), the lanes winning over your car, and "half of Delhi had the same idea". None needed rewriting.

### Changes: 50 unique strings (78 ids, since repeated menu and footer strings count once per page)
Grouped by reason:
- **Wrong word or register**
  - "property" had been translated as சொத்து, which reads like legal or real-estate "asset". It is now தங்குமிடம் throughout List Your Homestay (10 strings), e.g. "சொத்து வகை" → "தங்குமிட வகை".
  - "Optional" was விருப்பத்தேர்வு, which means "an option/choice". It is now கட்டாயமில்லை (3 strings).
  - "strong coffee": கடுமையான காபி → ஸ்ட்ராங் காபி.
  - "Footer navigation": அடிக்குறிப்பு (footnote) → அடிப்பகுதி.
  - "rapids": நீர்ச்சுழல்கள் (whirlpools) → சீறிப் பாயும் நீரோட்டங்கள்.
  - "Go live": நேரலைக்கு வாருங்கள் ("come on the live broadcast") → தளத்தில் இடம்பெறுங்கள்.
- **Grammar**
  - "திட்டம் அமையுங்கள்" uses an intransitive verb. Changed to "திட்டம் போடுங்கள்" (2 strings).
  - "…திட்டத்தில் சேருங்கள்" means "join". Changed to "சேர்த்துக்கொள்ளுங்கள்" (2 strings).
  - A verbless ending on the Kumbh "where to stay" paragraph was completed with "…தொலைவில் உள்ளது".
  - "உறுதியாக உறுதியாக" read like a typo. Changed to "உறுதியாகும்போது".
- **Place name**
  - Neer Garh had been written as நீர் கட். It is now நீர் கர் (4 strings).
- **Stiff or unnatural phrasing**
  - "ரிஷிகேஷ் ஒவ்வொரு பகுதிக்கும் மாறுபடுகிறது" → "ரிஷிகேஷின் தன்மை பகுதிக்குப் பகுதி மாறுகிறது".
  - The "vegetarian and alcohol-free menu" question now reads as a full sentence.
  - "Plan a Kunjapuri sunrise", "Plan the Garhwal gateway", "Nearby planning", "Weekend; expect heavy demand" (now says rooms will be hotly contested) and "Wheels for Rishikesh, minus the guesswork" were reworded.
  - "Footwear stays at the door" is now a polite instruction.
  - Toiletries: கழிப்பறைப் பொருட்கள் → குளியல் பொருட்கள்.
  - Other smaller fixes: "இலகுவான" changed to இதமான or ஓய்வான, "நடுநிலைத் தேர்வு" (neutral) → "நடுத்தரத் தேர்வு", "உறுதியளிக்கும் முன்" → "முடிவு செய்யும் முன்", "அரட்டை அடிக்க" → "WhatsApp-இல் பேசவே", "கம்பளி/ஜாக்கெட்" → "ஸ்வெட்டர் அல்லது ஜாக்கெட்", and "vs" → அல்லது.
- **Name kept**
  - "Advaitam Ganga hill-view 3BHK" had been half-translated. It now reads "Advaitam Ganga & Hill View 3BHK".
  - On Chotiwala, an added detail ("சோட்டி") that is not in the English was removed.

### Still uncertain or for the owner to decide
- விசாரணை is used for "enquiry" everywhere. It is standard on Tamil booking sites, but it can also suggest a police "inquiry". கோரிக்கை would be a softer alternative if the owner prefers it. I left it unchanged for consistency.
- The 2021 Kumbh figures are given in lakh (91 லட்சம் / 70 லட்சம) rather than millions. This is correct and more natural for Indian readers.
- Hindu calendar terms are in their Sanskrit-derived forms (மாக, பால்குன, சைத்ர), as the English has them. Tamil readers usually know these months as தை/மாசி/பங்குனி/சித்திரை. They were not swapped, because the tithi names refer to the North Indian calendar.
- Many short UI buttons use the polite imperative (-உங்கள்), and a few use the bare form (திற, அனுப்பு, காட்டு). Both are normal on Tamil websites, so they were left mixed.

## Telugu (te) copy-edit QA
<a id="te"></a>

### What was checked
- I read every page side by side with `en.json`: all 1,035 unique strings (1,540 entries). I checked grammar, natural phrasing, meaning (with a back-translation of any line in doubt), tone and jokes, consistent terms, script, and protected content.
- Structure check after editing: every id from `en.json` is present, with none missing or extra. The `<n>…</n>` and `<n/>` tags have the same count and order as the English. Emails, phone numbers, ₹ amounts, Booking.com, WhatsApp and Airbnb are unchanged. `JSON.parse` loads the file without errors.
- Consistency check: the same English string has the same Telugu translation on every page. Edits were applied by English string, so this still holds.

### Overall verdict
The translation was already strong. It reads as natural Telugu and keeps the guide voice. Most jokes were already rewritten for Telugu readers instead of translated word by word ("అవి మాత్రం తిరిగి ఊపవు", "ఇక్కడ సందులదే పెత్తనం", "పట్టు వదలని చాయ్‌వాలాలు", "ఒక్క చాయ్ తాగేలోపు అంతా సెట్", "జ్ఞానోదయం అయిపోయి ఉండొచ్చు").

### Changes: 41 unique strings, 70 entries
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

### Kept on purpose (from the translator's notes)
- These stay in English: the brand "Rishikesh Homestays", stay and cafe names (Advaitam, Little Buddha Cafe, Chotiwala, Cheetal Grand…), Booking.com, Airbnb, MakeMyTrip, WhatsApp, Zomato, Swiggy, Blinkit, FASTag, Rajmargyatra and Royal Enfield, plus phone numbers, the email and ₹ prices.
- Place names are written in Telugu script (రిషికేశ్, హరిద్వార్, లక్ష్మణ్ ఝూలా, త్రివేణి ఘాట్, హర్ కీ పౌడీ…).
- The 2021 Kumbh figures use Indian units (91 లక్షల, 70 లక్షల). An automatic number check will flag these. That is expected.

### Still uncertain or worth a look on the live page
- The index hero stats are split strings ("24 గంటలు" + "ఎంక్వైరీకి సమాధానమిచ్చే గడువు", "స్థానిక" + "గైడ్ పేజీలు కూడా ఉన్నాయి"). They read fine as label pairs, but the line breaks should be checked when the page is rendered.
- The 404 lines "ఈ పేజీ" / "గంగలో మునక వేయడానికి వెళ్లి" / "ఇక తిరిగి రాలేదు." only make a sentence when shown in sequence. This is fine as long as the markup keeps them inline.
- "ఐచ్ఛికం" (Optional) is formal but common on Telugu forms. "(అవసరమైతేనే)" is a friendlier alternative if the owner prefers it.

## Kannada (kn) QA: copy-edit pass
<a id="kn"></a>

### What was checked
- All 15 pages and 1,540 ids. Each of the 1,035 unique English strings was read side by side with its Kannada value.
- Each line was checked for grammar, natural phrasing, meaning (doubtful lines were back-translated), consistent terms, script, and whether the joke still works in the quirky lines: the 404 page, the parking and expressway asides, the bike-rental copy, and "half of Delhi has the same idea".
- Kept unchanged: property, cafe and brand names (Advaitam, Little Buddha Cafe, Chotiwala, Airbnb, Booking.com, MakeMyTrip, WhatsApp, FASTag, Zomato, Swiggy, Blinkit, Royal Enfield), ₹ amounts, phone numbers, the email address, and the `<0>…</0>` and `<0/>` tags. A script compared the tags against the English after the edits and found no mismatches. `kn.json` passes `JSON.parse`, and every page and id from `en.json` is still present.

### Overall verdict
The translation was already strong: idiomatic, natural Kannada with the guide voice intact. Most of the jokes already landed. Examples are "ಅವು ಮಾತ್ರ ತಿರುಗಿ ಕೈ ಬೀಸುವುದಿಲ್ಲ" (the elephants), "ನಮ್ಮ ಕಾರಿನ ಟೈರ್ ಅದರ ಮೇಲೆ ಉರುಳುವವರೆಗೆ ನಾವು ನಂಬುವುದಿಲ್ಲ", "ಕೊನೆಗೆ ಗೆಲ್ಲುವುದು ಓಣಿಗಳೇ", "ರಿವರ್ಸ್ ಗೇರ್ ನಾಟಕವಿಲ್ಲದೆ" and "ಛಲ ಬಿಡದ ಚಹಾ ಮಾರುವವರು". The edits below are fixes, not a rewrite.

### Changes: 33 unique strings (104 ids, because menu and footer strings repeat on every page)
- **Menu and short UI.** "Things to do" was "ಮಾಡಬೇಕಾದ್ದು", which reads like a chore list. It is now "ಚಟುವಟಿಕೆಗಳು" in the menu and footer (15 pages). The page title and links became "ರಿಷಿಕೇಶದಲ್ಲಿ ಏನೇನು ಮಾಡಬಹುದು" in every place they appear. "Plan my stay" was "ನನ್ನ ವಾಸ್ತವ್ಯ ಯೋಜಿಸಿ", which mixes "my" with a polite command. It is now "ವಾಸ್ತವ್ಯ ಯೋಜಿಸಿ". "Footer Navigation" was "ಅಡಿಟಿಪ್ಪಣಿ", which means footnote. It is now "ಪುಟದ ಕೆಳಭಾಗದ ನ್ಯಾವಿಗೇಶನ್".
- **404 jokes.** The split sentence "This page went / for a dip in the Ganga / and never came back." was a run-on with a redundant "ಮತ್ತೆ ವಾಪಸ್". It now reads "ಈ ಪುಟ / ಗಂಗೆಯಲ್ಲಿ ಒಂದು ಮುಳುಗು ಹಾಕಲು ಹೋದದ್ದು, / ಮತ್ತೆ ಮೇಲೆದ್ದು ಬರಲೇ ಇಲ್ಲ." ("went for a dip and never came back up"), which is the dark joke a Kannada reader would make. "Wait, I like it here" was "ತಡೆಯಿರಿ…", which sounds like "stop!". It is now the chattier "ಒಂದು ನಿಮಿಷ, ನನಗೆ ಇಲ್ಲೇ ಇಷ್ಟ ಆಯ್ತು". The awkward clause "ಯಾಕೆ ಬಂದಿರಿ ಅದನ್ನು ಆರಿಸಿ" was smoothed.
- **Flat or literal jokes rewritten.** "the lanes have opinions" was a literal "ಅಭಿಪ್ರಾಯಗಳಿವೆ". It is now "ಇಲ್ಲಿನ ಓಣಿಗಳದ್ದು ತಮ್ಮದೇ ಹಠ" (the lanes are stubborn). "Wheels for Rishikesh, minus the guesswork" was "ಚಕ್ರಗಳು, ಊಹಾಪೋಹವಿಲ್ಲದೆ", which reads as "wheels, without rumours". It is now "ರಿಷಿಕೇಶ ಸುತ್ತಲು ವಾಹನ, ತಲೆಬಿಸಿ ಇಲ್ಲದೆ". "depending on energy" is now "ಮೈಯಲ್ಲಿ ಎಷ್ಟು ಶಕ್ತಿ ಉಳಿದಿದೆಯೋ ಅದಕ್ಕೆ ತಕ್ಕಂತೆ…". "Roads can lock up" was "ಸ್ತಬ್ಧ", which sounds formal. It is now "ಪೂರ್ತಿ ಜಾಮ್ ಆಗಿ ನಿಂತುಬಿಡಬಹುದು".
- **Grammar and meaning.**
  - "ನಾಗಾ ಸಾಧುಗಳು ಒಬ್ಬರು" ("Naga sadhus are one person") is now "ನಾಗಾ ಸಾಧುಗಳ ಪರಂಪರೆಯೂ ಒಂದು".
  - "ಕಿರಿದಾದ ಕುಂಭ" (narrow) is now "ಮೊಟಕಾದ ಕುಂಭ" (curtailed), the correct meaning.
  - "ಒಂದೇ ಸಮಯಕ್ಕೆ ಹಲವು ಊರುಗಳಂತೆ ಇದೆ" is now "ಒಂದೇ ಊರಿನೊಳಗೆ ಹಲವು ಊರುಗಳು".
  - "ಬೆಳಗಿನ ಹೊರಡುವಿಕೆ" (an unnatural noun) is now "ಬೆಳಗ್ಗೆ ಹೊರಡುವ ಟ್ರಿಪ್‌ಗಳು".
  - "Get better, stay matches", "Built for traveller decisions", "2027 travel anchors", the Beatles Ashram line, the Places page title, the "easy to settle into" headline and the contact-page "ನಿಶ್ಶಬ್ದ" used as a noun were also rephrased to read naturally.
  - The Haridwar "25 km downstream" sentence now says "along the river's flow". It had read as if Haridwar sat on the riverbank 25 km below.
  - "ಊರಿನಿಂದ ಹೊರಗೆ" (Delhi) is now "ದೆಹಲಿಯಿಂದ ಹೊರಬರಲು".
- **Names.** The link label "Advaitam Ganga hill-view 3BHK" had been half translated ("Advaitam ಗಂಗಾ ಬೆಟ್ಟದ ನೋಟದ 3BHK"). It now uses the property's name as written: "Advaitam Ganga & Hill View 3BHK".

### Still uncertain or worth a visual check
- The 404 split sentence now has a comma at the end of the middle segment. Check that it still looks right if that segment is styled differently, for example highlighted or on its own line.
- AIIMS is written as ಏಮ್ಸ್ throughout, with "(AIIMS)" added at the first mention on some pages. That is the common Kannada press spelling. ಏಐಐಎಂಎಸ್ is the alternative if the owner prefers it.
- The guide voice is mildly colloquial in places, for example "ಐಡಿಯಾ", "ಮೂಡ್", "ಜಾಮ್" and "ಟ್ರಿಪ್". That is intentional and matches how Bengaluru travel sites write, but it is less formal than textbook Kannada.
- "Made with ❤️ in India" stays as "ಭಾರತದಲ್ಲಿ ❤️ಯಿಂದ ತಯಾರಿಸಲಾಗಿದೆ", where the emoji stands in for the word "love". This is fine as is.

## Marathi (mr) QA notes: native copy-edit pass
<a id="mr"></a>

### What was checked
- I read all 1,035 unique English strings next to their Marathi, page by page, across all 15 pages. Edits were made once per unique English string and applied to every id that has the same English, so the shared menu and footer stay identical across pages.
- Each string was checked for grammar and agreement, natural phrasing versus word-for-word phrasing, meaning (doubtful lines were back-translated), tone in the quirky lines (404 page, driving guide, rental page), consistent terms, script and nukta use, and protected items.
- A script then checked the result:
  - `mr.json` parses with `JSON.parse`.
  - It has the same 15 pages and 1,540 ids as `en.json`, with no empty values.
  - The `<0>…</0>` / `<0/>` tags match the English in count and order.
  - Every ₹ amount, +91 phone number, email address and URL is unchanged. The result was 0 problems.

### Changes: 33 unique strings (47 ids)
- **Wrong meaning:**
  - 404: "Chotiwala भाऊजी" became "Chotiwala भाऊंना". In Marathi, भाऊजी means brother-in-law, not "bhai ji".
  - Rafting context: "the most famous hub" became "one of the most famous hubs" (सर्वात प्रसिद्ध केंद्रांपैकी एक), as in the English.
  - Advaitam page: "Not the right fit?" was "हे तुम्हाला जमत नाही?" and is now "हे घर तुमच्यासाठी योग्य नाही?".
- **Grammar and agreement:**
  - "हलकं उबदार कपडे" became "हलके उबदार कपडे".
  - "निवांत सकाळी" was used as a plural noun. It is now "निवांत सकाळ" on the 404 page, the Advaitam "Slow mornings" heading and the yoga context lines.
  - "योगाच्या सकाळी" became "सकाळचा योग".
  - "एक मोठं ट्रॅफिक जॅम" became "एका मोठ्या ट्रॅफिक जॅममुळे".
  - The Triveni Ghat intro had an unfinished clause. It now reads "…ती एक अविस्मरणीय संध्याकाळ ठरते".
  - "(The Arches) …कायम असतं" now has a subject: "याचं नाव कायम असतं".
- **Unnatural or literal phrasing:**
  - "प्रवाशांच्या निर्णयासाठी बनवलेले" became "प्रवाशांना निर्णय घेणं सोपं जावं म्हणून".
  - "पुलाला भेट आखा" became "पूल पाहण्याचं नियोजन करा".
  - "तपोवनमधल्या सकाळीसोबत…जोडा" became "तपोवनमधली सकाळ आणि … एकत्र आखा".
  - "कुंभाचं दिसणारं हृदय…श्रद्धा आणि गती" became "डोळ्यांना दिसणारा कुंभ…श्रद्धा आणि लगबग".
  - "गर्दी नियंत्रित पद्धतीने सोडली जाईल" became "गर्दीच्या हालचालींवर नियंत्रण असेल".
  - "प्रत्यक्ष जमिनीवरची टीम" became "प्रत्यक्ष इथे असलेली टीम".
  - The "not a distant call center" line now has a full sentence.
  - The host step now says who confirms the booking.
  - The 150cc bikes line was rewritten.
  - "Rentals" became "वाहने भाड्याने".
  - "कोणता भाग तुम्हाला जमेल" became "…सोयीचा आहे".
  - "back-and-forth of a large platform" is now "संदेशांच्या उलटसुलट फेऱ्या".
  - The bedroom alt text was reordered.
- **Jokes and voice, sharpened:**
  - 404: "संभाव्य बातमी" became "दिसल्याची खबर". The line "शेवटचा आवाज…ऐकू आला" became "शेवटची हाक…तंबूतून ऐकू आली".
  - Expressway elephants: "हात हलवा" became the idiomatic "हात करा… ते काही उलट हात करणार नाहीत".
  - "the lanes have opinions" was "गल्ल्यांची स्वतःची मतं आहेत", a literal rendering. It is now "गल्ल्यांचा तोराच वेगळा".
  - "the most Rishikesh way" is now "अस्सल ऋषिकेशी पद्धत".
  - "minus the guesswork" is now "अंदाजपंचे न करता".
- **Script:**
  - "वसिष्ठ गुफा" became "वसिष्ठ गुहा", which is the Marathi word.
  - "तेरा मंज़िल" became "तेरा मंजिल". Marathi doesn't use the nukta. The alt text was fixed the same way.

### Left as is, on purpose
- The rest of the file was already natural and accurate, and it keeps the guide voice. Examples: "बहुधा मोक्षप्राप्ती झाली असावी", "त्या गल्ल्यांपुढे तुमची हार ठरलेली आहे", "एका कप चहात सगळं ठरतं" and "आमच्या गाडीची चाकं त्यावर टेकतील तेव्हाच आम्ही विश्वास ठेवू".
- Headings and nav use the -ए plural (ठिकाणे, काय करावे), while body text uses the spoken -ं form (ठिकाणं, मंदिरं). Marathi websites commonly do this, so it was kept.

### Still uncertain
- **Plural style:** a mix of -ए and -ं plurals appears in body text, such as मंदिरे in short UI lists and मंदिरं in paragraphs. The owner may want one style site-wide.
- **Brand name:** "Advaitam Ganga & Hill View homestay" is kept in Latin script inside a Marathi sentence, where the English has a lowercase "homestay". A reader could also expect "होमस्टे" there.
- **Kumbh figures:** the 2021 numbers are given in lakh (91 लाख / 70 लाख), as in the first pass.

## Nepali (ne) QA notes
<a id="ne"></a>

### Translation notes (from the first pass)

- 15 pages, 1,540 strings. Every id from en.json is present. Tags and placeholders (`<0>`, `<0/>`, `{..}`, entities) match the English in number and order.
- Digits: Western digits (0-9) everywhere, including ₹ prices, phone numbers, dates and counts.
- Script: place names are in Devanagari, written the way Nepali readers write them (ऋषिकेश, हरिद्वार, लक्ष्मण झूला, त्रिवेणी घाट, स्वर्गाश्रम, मुनि की रेती, नीलकण्ठ, हर की पौडी). Brand, property and cafe names stay in Latin script (Rishikesh Homestays, Advaitam Ganga & Hill View, Little Buddha Cafe, Chotiwala, Beatles Ashram, Booking.com, WhatsApp, Airbnb, FASTag, Rajmargyatra, Zomato).
- Register: the polite "तपाईं" form throughout, with "-नुहोस्" imperatives in the UI.

### Copy-edit pass (strict native review)

**What was checked:** every string on all 15 pages was read side by side with the English. Each one was checked for:

- grammar
- natural phrasing versus word-for-word phrasing
- meaning (doubtful lines were back-translated)
- whether the jokes land
- consistent terms
- script
- untouched names, prices, phones, emails, URLs, tags and placeholders

**Result:** 96 strings changed across 82 ids. Some ids repeat across pages, such as the footer and nav strings.

**Validation after editing:**

- The JSON is valid, with the same pages and ids in the same order.
- Tag and placeholder sequences match the English in all 1,540 strings.
- Phone numbers, the email address and the ₹ amounts appear the same number of times as in the English.

#### Main kinds of fixes, with examples

1. **"Base" was rendered as आधार (~25 strings).** In Nepali, आधार reads as "foundation/basis", or as the Aadhaar ID card. It does not mean "a place to stay". These now say बस्ने ठाउँ, बसाइ or बस्नका लागि, depending on the sentence.
   - "a calmer base" → "बस्नका लागि शान्त ठाउँ"
   - "Find a flexible stay base" → "योजना फेरिए पनि मिल्ने बसाइ खोज्नुहोस्"
   - "Choose your homestay base" → "बस्नका लागि होमस्टे छान्नुहोस्"
   - "आधार/पासपोर्ट/भिसा" (the Aadhaar ID) was left as it was.
2. **"Property" was rendered as सम्पत्ति, which means wealth or assets.** On the list-your-homestay page it is now प्रोपर्टी, the word Nepali hospitality sites use. "For property owners" became "घरधनी र होस्टहरूका लागि".
3. **Jokes and quirky lines were rewritten so they land in Nepali:**
   - 404, Chotiwala's "just 5 minutes ahead" → “यही 5 मिनेट पर”. This is the classic Nepali trail-distance joke.
   - 404, "presumed enlightened" → "सायद ज्ञान प्राप्त गरिसक्यो". The old version was a clipped noun phrase.
   - 404, "Route status: delightfully lost" → "मज्जाले हराएको"
   - 404, the rafters "flipped twice" → "दुई पटक डुङ्गै पल्टाइसके"
   - Driving, "the lanes have opinions" → "गल्लीहरूका आफ्नै नखरा छन्"
   - Driving, "very determined chai sellers" → "कुनै हालतमा पछि नहट्ने चिया बेच्नेहरू"
   - Driving, "the lanes will win" → "अन्त्यमा जित्ने गल्लीहरूले नै हो"
   - Driving, the elephants line → "उनीहरूले भने फर्केर हात हल्लाउने छैनन्"
   - Bike page, "sorted over one chai" → "एक कप चिया सकिनुअघि नै मिलान"
4. **Grammar and naturalness:**
   - The dangling "…सजिलो छ, भने …" now uses अनि, and "…गर्छन्, भने …" now uses जबकि. The comma made भने read as "if".
   - "अर्का उपयोगी कदम" → "अबका उपयोगी कदम"
   - "सुझावका लागि खुला" → "तपाईंहरू नै सुझाउनुहोस्"
   - "भारतमा ❤️ सहित बनाइएको" → "भारतमा ❤️ ले बनाइएको"
   - "सडक-अन्त्य" (roadhead) → "गाडी पुग्ने अन्तिम ठाउँ"
   - "Haridwar transfers": "हरिद्वार यात्रा" → "हरिद्वार आवतजावत"
   - The bike FAQ answer repeated itself, so it was rewritten.
   - The Advaitam captions "सास फेर्ने ठाउँ नगुमाई" and "दिनलाई ऋषिकेशले नै आकार दिन दिनुहोस्" were literal calques and were rewritten.
5. **Meaning fixes:**
   - Advaitam, "a 5+ day staycation" had become "5 दिनभन्दा लामो", which means more than 5 days. It is now "5 दिन वा बढी", matching the 5+ day discount rule.
   - Homestays, the "sample listings, ready to replace with verified properties" line is now correct and natural.
   - Kumbh, "other 2027 travel anchors" is now "अन्य काम लाग्ने मितिहरू".
6. **Loanwords:** "स्टेकेसन" (staycation) became "लामो छुट्टी". "वर्केसन" (workation) was kept, because it is a short chip label.

### Still uncertain or worth a native glance

- "वर्केसन" is a loanword that urban Nepali readers know. A gloss such as "काम गर्दै घुमाइ" would be clearer, but it is too long for the filter chips.
- "Stay" as a footer column heading is rendered as "बसाइ". This is fine, but some sites would use "बास".
- Hindu calendar terms follow Nepali usage (औँसी, भाइटीका for Bhai Dooj). Readers from Indian Nepali-speaking areas such as Darjeeling and Sikkim might expect "भाइ दूज". Both are understood.
- "Tera Manzil" is written "तेरह मञ्जिल", following the Hindi name that the English explains. A Nepali reader would say "तेह्र तले".

## Sinhala (si) QA
<a id="si"></a>

### What was checked
- All 1,035 unique strings, compared with `en.json`: UI labels, form fields, headings, alt texts, long guide paragraphs, the 404 jokes, and the sarcastic lines on the driving and bike pages.
- I checked terms for consistency: හෝම්ස්ටේ, නවාතැන, ඝාට්, ගංගාව/ගඟ, චෙක්-ඉන්, ත්‍රීවීල් (auto-rickshaw) and වර්කේෂන්. I also checked script use: brand, stay and cafe names stay in Latin, and place names are in Sinhala.
- `JSON.parse` passes, and `node scripts/i18n/stale.mjs si` reports 0 missing, 0 orphaned and 0 suspect.

### Changes (13 strings)
- **Wrong meaning (2):** "half-day" had been translated as පැය භාගයක, which means "half an hour". It now reads භාග දවසක (Neelkanth temple visit, "Make a half-day temple trip").
- **Wrong meaning (1):** "hosts who can sort your wheels" had been rendered as if hosts *have already* arranged a vehicle. It now says they *can* arrange one.
- **Quotes (6):** German-style „…“ quotes in the 404, about, places, kedarnath and Kumbh lines became the standard “…”.
- **Tone or naturalness (4):**
  - "Featured Homestays" changed from විශේෂාංග හෝම්ස්ටේ to තෝරාගත් හෝම්ස්ටේ.
  - "Go live" changed from සජීවී වෙන්න (which sounds like live-streaming) to අඩවියේ පළ වෙන්න.
  - "Goes via" changed from the awkward යන්නේ හරහා to යන්නේ මේ හරහා.
  - "Royal Enfield country" changed from රාජ්‍යය to ලෝකය.
  - The "very determined chai sellers" joke now reads කවදාවත් අත්හරින්නේ නැති චායි වෙළෙන්දෝ, which keeps the joke.

### Overall
The translation was already of high quality. It reads as natural, colloquial written Sinhala that fits the guide voice. The 404 jokes work in Sinhala, for example "presumed enlightened" → බොහෝ විට නිවන් දැකලා. Placeholders, ₹ amounts, phone numbers and the email address are all intact.

### Uncertain
- The style is conversational (කියලා, නෑ, ඕනේ) rather than formal. This fits the site's voice, but a formal Sinhala reader may expect ලිඛිත style in the long history paragraphs.
- The Kumbh numbers add ලක්ෂ conversions next to the millions, for example "මිලියන 9.1ක (ලක්ෂ 91ක)". These are correct, but the English doesn't have them.
- "Advaitam Ganga hill-view 3BHK" keeps the brand name and translates the descriptor. Other Advaitam strings keep "Ganga & Hill View" in English because it is the property name.

## Chinese, Simplified (zh) translation notes
<a id="zh"></a>

### Translator pass
- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json present. Tags (<0>, <0/>…), ₹ amounts, phone numbers, emails checked automatically: same count and order in every string.
- Left unchanged (identical to English): property name "Advaitam Ganga & Hill View Luxury 3BHK" (and "Advaitam Ganga and Hill View" in alt text), cafe/restaurant names (Little Buddha Cafe, Chotiwala…), brand names (Airbnb, Booking.com, MakeMyTrip, WhatsApp, Zomato, Swiggy, Blinkit, FASTag, Royal Enfield, Rishikesh Homestays), the Devanagari mantras, AIIMS.
- Place names in the usual mainland transliterations: 瑞诗凯诗 (Rishikesh), 哈里德瓦 (Haridwar), 恒河 (Ganga), 拉克什曼吊桥 (Laxman/Lakshman Jhula), 罗摩吊桥 (Ram Jhula), 特里维尼河坛 (Triveni Ghat), 哈基保里 (Har Ki Pauri), 塔波万 (Tapovan), 斯瓦格修行区 (Swarg Ashram), 穆尼基雷蒂 (Muni Ki Reti), 尼尔坎特 (Neelkanth), 凯达尔纳特 (Kedarnath), 巴德里纳特 (Badrinath), 德里/德拉敦/密拉特/鲁尔基 etc. Lesser-known temples/ashrams/bridges get a Chinese name plus the English in brackets on their card heading (e.g. 帕尔马特修行院（Parmarth Niketan）) so travellers can match local signs; small neighbourhoods (Nirmal Bagh, Kankhal, Bhupatwala, Shantikunj) kept in Latin script.
- Terms: homestay = 民宿; Ganga Aarti = 恒河夜祭; ghat = 河坛; ashram = 修行院; Kumbh Mela = 大壶节; Amrit Snan = 甘露圣浴; Char Dham = 四圣地; workation = 旅居办公; scooty = 踏板车; tempo traveller = 中巴（Tempo Traveller）; dharamshala = 朝圣客栈.
- "15% off" rendered the Chinese way as 85 折 (same discount).
- Kumbh table: tithi/occasion names given as Chinese gloss + romanised Sanskrit in brackets, since Chinese readers won't know the Hindu calendar names and locals will use the romanised ones.
- Jokes rewritten, not literal: 404 ("迷路迷得很开心", "疑似已经开悟", Bollywood twins), expressway elephants ("想挥手就挥吧，反正它们不会理你"), Haridwar spur ("等我们自己的轮胎真碾上去了，我们才信"), lanes ("你斗不过那些巷子", "小巷们自有主张"), "sorted over one chai" → "一杯奶茶的工夫就搞定".
- Pakoras and cutlets at Cheetal Grand given as 炸蔬菜团子 and 蔬菜炸饼, so a vegetarian reader does not read 肉 (meat) into "cutlet".

### Native copy-edit pass (zh-CN, strict)
- Checked: all 1,035 unique strings across the 15 pages (1,540 ids), each read against the English. I checked grammar, natural mainland phrasing, meaning (back-translated any doubtful line), tone and jokes, term consistency (民宿 / 河坛 / 修行院 / 恒河夜祭 / 大壶节 / 踏板车 / 中巴), script, and that names, brands, ₹ prices, phone numbers, emails, URLs and tags stayed untouched.
- Overall the translation was already good: fluent, idiomatic, and the jokes (404, elephants, "the lanes will win", the spur road) were adapted rather than translated word for word.
- Changed: 30 unique strings (44 ids, because of repeats such as the footer). Examples:
  - Unnatural or translationese: footer "用 ❤️ 在印度制作" → "在印度用 ❤️ 打造"; "还在找什么特定的东西？" → "还没找到你想找的内容？"; "当住宿和一份清晰的…行程挂上钩，旅行者通常下单更快" → "住宿要是能配上一份清晰的…行程，旅行者往往更快拿定主意"; "河流、急流，和一个更新的冒险身份" → "河流、激流，以及后来的冒险新身份"; "在瑞诗凯诗玩什么——不赶时间的玩法" → "在瑞诗凯诗慢慢玩，不必赶场"; "住在河边附近" → "住在河边" (the original said "near" twice).
  - Wrong or shifted meaning: "seasonal water flow" was rendered as 季节性水量可观 ("plenty of water"), now 水量随季节变化; "mela instructions" was rendered as 庙会 ("temple fair"), now 大壶节管理方; "Easy for short groups" now 人少时坐它最方便; "Show home view" was 查看家中景色, now 查看窗外景色; the extra Chinese word 次数 in "以及会用掉几次次数" removed; the redundant "市区禁止在市政范围内" removed.
  - "group" was translated as 团队 ("work team"), now 一行人; "这一组人" now 一行人.
  - Jokes: elephants "They will not wave back" sharpened to "想挥手尽管挥，它们可不会冲你挥回来"; Cheetal Grand "has fed families for decades" no longer reads as the awkward 喂饱着…一家家人.
  - Smaller fixes: FAQ "Yes, outstation cabs…" started with a bare 安排, now 可以。我们提供…; 在周中 → 适逢周中; 打算赶着大壶节出行 → 打算趁大壶节出行; "AIIMS 瑞诗凯诗" → "瑞诗凯诗 AIIMS".
- Re-verified after editing: valid JSON, same 15 pages and the same ids in the same order, and tags, entities, {placeholders}, ₹ amounts, phone numbers and emails match the English in every string (0 mismatches).
- Still uncertain:
  - Transliterations of lesser-known temples (设睹卢祇那神庙 for Shatrughna uses the classical Buddhist-sutra spelling, and 巴吉朗玻璃桥 for Bajrang Setu) are not standard in Chinese guidebooks. They are kept because the English name is shown in brackets on the card heading.
  - Janki Setu (贾娜基桥) and Janki Pul (贾娜基吊桥) are the same bridge, given slightly different names as in the English.
  - Hindu calendar terms in the Kumbh table (太阴日, Magha 月黑半月…) are explanatory glosses, not established Chinese terms.
  - "爽到飞起" (Royal Enfield) is deliberately colloquial internet slang, matching the playful English.

## QA notes: Spanish (es), copy-edit pass
<a id="es"></a>

### Checked
- All 15 pages and 1,540 ids (1,035 unique strings) read side by side with en.json. Lines that sounded doubtful were back-translated.
- Grammar and natural phrasing, meaning, tone on the quirky lines (404, the elephants that won't wave back, the tyres, the lanes, the chai), consistent terms, and register.
- Things that must not change: names, brands, prices and ₹ amounts, phones, emails, URLs and tags. After editing, a script checked that the `<n>`, `</n>` and `<n/>` tags, `{…}` placeholders, entities, ₹ amounts, +91 numbers and emails match the English in count and order for every string: 0 mismatches. Every page has the same ids as en.json, and the file parses with JSON.parse.

### Changed: 68 strings (68 unique ids)
Overall the translation was good. The edits fall into these groups:

1. **Spain-only "vosotros" removed (14 strings).** The translator used "vosotros" forms ("cuántos sois", "llegáis", "os importa", "¿Podéis…?", "¿Organizáis…?", "con vosotros", "Descansad", "Cocinad, usad…"). A large part of the Spanish-speaking world never uses these forms, so they don't fit neutral international Spanish. The site now uses "tú" for the reader and "ustedes" for the company or the group.
   - "cuántos sois" became "cuántas personas viajan" or "el tamaño de tu grupo".
   - "¿Podéis organizar…?" became "¿Pueden organizar…?".
   - "Cocinad juntos, usad…" became "Pueden cocinar juntos, usar…".
2. **Neutral vocabulary.**
   - aparcar/aparcamiento (Spain) became estacionar/estacionamiento everywhere (about 30 strings).
   - Frigorífico became Refrigerador.
   - "puentes festivos" (Spain-specific) became "fines de semana largos" (4 strings).
3. **Grammar and agreement.** On the 404 page, "Visto por última vez" became "Vista por última vez", because the subject is la página (it is already "presuntamente iluminada").
4. **Unnatural or awkward lines.**
   - "Solo/a" became "En solitario".
   - "objetivo de respuesta a consultas" became "nuestro objetivo para responderte".
   - "según lo autoricen las autoridades" became "siempre que haya permiso local".
   - "Planifica la puerta de Garhwal" became "Planifica tu entrada a Garhwal".
   - "Elige la base de tu alojamiento" became "Elige dónde alojarte".
   - "pide libre el 15 de enero" became "pide el día libre el…" (4 strings).
   - "Solicítalo" and "Publicación" became the step labels "Envía tu solicitud" and "Publica tu anuncio".
   - "un alojamiento en casa" became "¿Recibes huéspedes en tu casa…?".
   - "Alojamiento en casa (habitación en una casa familiar)" became "Habitación en casa de familia".
   - "¿Listo para reservar…?" became the gender-neutral "¿Todo listo para reservar…?".
   - "en auto, coche…" became "en autorickshaw, coche…", because "auto" means car in Latin America.
5. **Jokes that fell flat.**
   - "the lanes have opinions" was rendered as "las callejuelas tienen su carácter", which is flat. It is now "las callejuelas tienen opinión propia".
   - "minus the guesswork" was rendered as "sin adivinanzas". It is now "sin sorpresas".
   - "atento a los avisos" became "no pierdas de vista los avisos".
   - "Pregunta por el estacionamiento… usa un estacionamiento" repeated a word; the line was reworded.

### Kept on purpose
- Informal "tú" throughout. "Alojamiento" for homestay, and the brand "Rishikesh Homestays" unchanged.
- "el Ganges" in running text, with ritual names kept as they are (Ganga Aarti). "la Kumbh" is feminine.
- Spanish decimals for numbers that aren't prices (2,5 km, 5,0). ₹ amounts are byte-identical to the English (₹1,000).
- Times in 24-hour format.
- Jokes that already landed well: "presuntamente iluminada", "No te van a devolver el saludo", "nos lo creeremos cuando lo pisen nuestras propias ruedas", "las callejuelas siempre ganan", "resuelto en lo que dura un chai", "Medio Delhi ha tenido la misma idea que tú".

### Still uncertain
- "coche" and "móvil" are Spain-leaning but understood everywhere, so they were kept. A Latin America-first audience might prefer "auto" and "celular".
- "tortitas" (pancakes) is the Spain word. Mexico would say "hotcakes" and the Southern Cone "panqueques". It was kept because no single word works everywhere.
- "La ciudad, de un vistazo" and other short UI labels were kept as the translator wrote them. They are fine, but the owner may want them shorter for the nav.
- "Lakshman Jhula" and "Laxman Jhula" both appear, because the English source uses both. They were left as they are.

## French (fr) translation notes
<a id="fr"></a>

### Translator pass
- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json present; tags/placeholders checked (same count and order); ₹ amounts, phones, emails, URLs unchanged (₹1,000 kept with its English comma as in source).
- Place names in Latin script as French travellers write them: Rishikesh, Haridwar, Laxman/Lakshman Jhula (as in the English), Ram Jhula, Triveni Ghat, Har Ki Pauri, Swarg Ashram, Muni Ki Reti, Tapovan, Neelkanth; the river is « le Gange », the ceremony « le Ganga Aarti » / « l’aarti ». Kumbh is feminine (« la Kumbh », « la Kumbh Mela »).
- "Homestay" kept as « homestay » (masculine); "workation" kept; "German bakeries" kept as the local category name.
- 3BHK rendered as « 3 chambres »; the listing's own name "Advaitam Ganga & Hill View Luxury 3BHK" left unchanged.
- 11-foot Shivalinga given as « 3,35 m (11 pieds) ».
- Hindi mantras (ॐ नमः शिवाय, हर हर गंगे) left in Devanagari, as in English. Typographic apostrophe ’ and French spacing before : ? ! throughout.

### Copy-edit review (native French, strict)
Checked every unique string on all 15 pages side by side with the English for grammar, natural phrasing, meaning (back-translated doubtful lines), jokes/tone, terminology, and protected items. The translation was already good. **42 unique strings changed** (42 occurrences; shared nav/footer strings were left as they were). Re-validated afterwards: valid JSON, 15 pages, same ids, same tags/placeholders, ₹ amounts, phones and emails in each string.

#### Meaning errors fixed
- 404 « les raftings partis à sa recherche » (a rafting *activity* went looking) → « l’équipe de rafting partie à sa recherche a déjà chaviré deux fois ».
- Reviews quote: « les hôtes y saluent » (ambiguous: hôte = host or guest) → « les voyageurs y saluent ».
- Index stat "Stay 5+ days": « 5 nuits » → « 5 jours », to match the English and the Advaitam page.
- Kedarnath: « jusqu’au bout de la route de Kedarnath » (repeated "route") → « terminus routier » (twice).
- « à quelques kilomètres » for "a short drive away" → « à quelques minutes de route ».

#### Flat or awkward jokes sharpened
- « juste à 5 minutes devant » → « qu’à 5 minutes, juste devant » (Chotiwala's promise).
- Signpost: « n’arrive pas à se décider sur la direction qu’elle a prise » → « n’arrive pas à dire par où elle est partie ».
- « merveilleusement perdu » → « délicieusement égaré ».
- Haridwar lanes: « les ruelles gagnent toujours » → « les ruelles auront le dernier mot » (echoes the parking heading « les ruelles ont leur mot à dire »).
- Taxi: « sans un seul mauvais virage » (literal) → « sans se tromper une seule fois de route ».
- Chotiwala mascot « qu’on ne peut pas rater » → « reconnaissable entre mille ».

#### Unnatural or machine-sounding phrasing rewritten (examples)
- « Mieux vaut l’intégrer… que d’essayer de la contourner » (unclear « la ») → « Mieux vaut en tenir compte… que d’aller à contre-courant ».
- « Préparer la porte d’entrée du Garhwal » → « Partir vers le Garhwal »; « Organiser les alentours » → « À proximité »; « Organiser autour de votre yatra » → « Préparer votre yatra ».
- « trouver une place respectueuse » → « trouver discrètement votre place ».
- « Loger près de votre itinéraire du lever de soleil » → « Loger sur la route du lever de soleil ».
- « Les meilleures expériences pour une première fois » → « Les incontournables pour une première visite ».
- « Le rafting fonctionne » → « Le rafting se pratique »; « au Arches Cafe » → « à The Arches Cafe »; « de l’autre côté du fleuve par rapport à » → « sur la rive opposée à ».
- Kumbh table notes « Un week-end : … » → « Tombe un week-end : … »; « Occasion de la Kumbh » → « Événement de la Kumbh ».
- Repetitive « Cela… cela » in the adventure paragraph; « la file… un long week-end » word order; Kedarnath « approche » → « montée ».

### Still uncertain
- Index stat "Local / guide pages included" is a terse number-plus-label tile in English; now « 100 % locaux » + « guides pratiques inclus ». Check it reads well in the layout.
- "Homestay" kept in English (masculine). « Chambre d’hôtes » / « logement chez l’habitant » would be more French, but the brand uses the word everywhere; owner's call.
- « Moto & taxi » in the nav keeps "&" as in English; « Proposer votre homestay » could be « Inscrire votre homestay » if the owner prefers.
- Gender of « aarti » follows usage (« le Ganga Aarti », « l’aarti »); French sources vary.
- "₹1,000" keeps the English thousands comma (protected as a price).

## QA notes: Portuguese, Brazilian (pt)
<a id="pt"></a>

### What was checked
- All 15 pages and 1,540 ids. I compared every string with the English and read them side by side as a native Brazilian copy editor. I grouped the 1,035 distinct English strings so that each was read once. Every repeated string (nav, footer, buttons, form labels) has exactly one Portuguese version, so terms stay consistent across pages.
- Grammar, natural phrasing, meaning (doubtful lines back-translated), joke and sarcasm landing (404 page, elephants, "lanes have opinions", "believe it when our tyres touch it", "sorted over one chai"), term consistency, and protected text.
- Protected text was re-checked by script after editing. Tags `<n>`, `</n>` and `<n/>`, `{…}`, HTML entities, ₹ amounts, +91 numbers, emails and URLs match the English in count and order: 0 mismatches. `JSON.parse` passes, and the pages and ids are identical to `en.json`.

### Overall verdict
The translation was already strong: idiomatic Brazilian "você" voice, correct Portuguese, and jokes that were rewritten rather than translated literally. Most lines needed no change.

### Changes: 53 distinct strings, 52 ids
1. **Clunky or calqued phrasing (most edits)**
   - "Onde ficam os agrupamentos?" became "Onde eles se concentram?"
   - "hospedagens iniciais anunciadas" became "hospedagens para começar".
   - "nossa meta para responder" became "meta de resposta aos pedidos".
   - "destino de peregrinação hindu doméstico" became "… para os próprios indianos".
   - "a cidade só cresceu a partir disso" became "a cidade aproveitou esse impulso".
   - "Um olhar mais de perto na casa" became "Conheça de perto a casa e o seu entorno".
   - "Planta e acomodações para dormir" became "Distribuição dos quartos e camas".
   - "Dê ao grupo todo espaço…" became "Espaço para o grupo todo ficar junto", because the old line was ambiguous.
   - "Planejamento por perto" became "Planeje o entorno".
   - "Planeje em torno dele" became "Monte sua viagem em torno do Kumbh".
   - "uma beira-rio central" became "um trecho central da beira-rio".
   - "fileira de cafés" became "rua cheia de cafés".
   - "extensões a Dehradun" became "esticadas até Dehradun".
2. **Meaning fixes**
   - "floresta de sal" read as "salt forest". It is now "florestas de árvores sal", the sal tree.
   - "A busca … está incluída?" (pickup) was ambiguous. It is now "A atividade inclui buscar você na região da hospedagem?"
   - "um lugar respeitoso" became "um bom lugar, sem atrapalhar ninguém".
   - "Easy for short groups … para ser buscado" was reworded so that it is clear the driver picks you up.
   - "um dos formadores do Ganges" became "um dos rios que formam o Ganges".
   - Kumbh table: "Dia de banho de abertura divulgado" became "Primeiro dia de banho divulgado", "Amrit Snan de encerramento divulgado" became "Último Amrit Snan divulgado", and "grande período" became "auge da peregrinação".
3. **Host form register**
   - "candidatura/candidatar" sounds like a job application. It became "inscrição/inscrever-se", for example "Inscreva sua propriedade", "Enviar inscrição" and "Inscreva-se".
   - "Contatos de hóspedes compatíveis" became "Hóspedes com o perfil certo".
   - "critério curto e honesto" became "poucos critérios, e todos honestos".
4. **Gendered (a) forms removed**
   - "Sozinho(a)" became "Viagem solo".
   - "Aberto(a) a sugestões" became "Aceito sugestões".
5. **Voice and jokes sharpened**
   - "Status: provavelmente iluminada" became "dada como iluminada", which parodies "dada como desaparecida".
   - "pode virar a resposta de ponta-cabeça" became "pode virar o jogo".
   - "sem drama de dar ré" became "sem drama de manobra".
   - "Uma casa privativa … se sentir em casa" repeated "casa". It became "Um lar só seu perto do Ganges, onde você se acomoda num instante!"
   - "alongue-se" became "estique as pernas".
6. **Small fixes**
   - "Vindo de (cidade)" became "Cidade de origem" (2 ids).
   - "De carro saindo de Delhi" became "Vindo de carro de Delhi".
   - "3BHK de luxo privativo" was reworded, with "três quartos" glossed once in the Delhi guide.
   - Comma placement in "Pegue as chaves (ou encontre seu motorista) e pé na estrada."

### Kept on purpose
- Brand and property names, "Menu", "Check-in"/"Check-out", Hindu calendar names, the Devanagari lines, and "3BHK" (the listing's own term).
- "o Ganges" in running text, with Ganga Aarti and Ganga Ghat kept in ritual and property names.
- "o yatra" in the masculine, used the same way throughout. "Scooter", "autorriquixá", "e-riquixá" and "van tempo traveller" were also kept.
- Plural imperatives addressed to a group on the Advaitam page ("Cozinhem juntos, usem a sala…"). This is natural in Brazilian Portuguese.

### Still uncertain
- "3BHK" stays opaque to most Brazilians. It is explained in context, but the owner may prefer "apartamento de 3 quartos" in headings. The page title and URL slug were left alone.
- "Gerador / inversor" for "power backup / inverter" is accurate, but many Brazilians would say "nobreak".
- Image alt texts that say "Editorial view" were rendered as "Ilustração". That is fine if the images really are illustrations.

## Russian (ru) QA review
<a id="ru"></a>

### What was checked
- All 15 pages and 1,035 unique ids (1,540 strings) were read side by side with en.json. Checks covered grammar, natural phrasing, meaning (doubtful lines were back-translated), tone on the quirky lines (404, road-trip jokes, parking, disclaimers, tips), consistent terms, script, and anything that must stay unchanged.
- Integrity after the edits, checked by script: JSON.parse passes; all 15 pages are present with the same ids and the same per-page counts as en.json; `<0>`/`<0/>` tags, entities and `{placeholders}` match in count and order (0 mismatches); ₹ amounts, phone numbers and emails match the English (0 mismatches); no value was left in English apart from the brand names below.

### Changes: 98 unique ids, 141 strings in total (shared nav and footer ids repeat across pages)
- **Grammar and calques.** «Едьте» became «Езжайте». «где живут сотни ашрамов» became «с сотнями ашрамов». «исток Бхагиратхи, одного из истоков Ганга» repeated "исток", so it became «здесь берёт начало Бхагиратхи, одна из рек, образующих Ганг». «Она проходит через больше городов» became «Городов по пути больше». «Просыпайтесь от свежего воздуха» became «Встречайте утро со свежим гималайским воздухом».
- **Machine-sounding phrasing.** «Используйте это, чтобы…» became «Пригодится, чтобы…». «Сначала выберите правильную часть города» became «Сначала выберите район, а уже потом — номер». «время найти уважительное место» became «спокойно найти место, никому не мешая». «Планируйте вокруг этого» became «Что ещё пригодится». «Выбирайте базу по тому, какими вы хотите видеть свои дни» was rewritten. «Практичный гид» became «Практический гид» everywhere.
- **Terms.** "Workation" was a bare loan word («воркейшн»), so it became «Удалёнка» in the short select option and «удалённая работа» / «совмещает работу с отдыхом» in sentences. "Solo" became «Соло». The eyebrow labels «Обзор» and «Открытия» read like "overview" and "discoveries", so they became «Путеводитель» and «Интересное». "Footer navigation" became «Нижняя навигация». "Bike & taxi" became «Байки и такси». Restaurant names stay in Latin script, so the 404 line now uses «бхаи-джи из Chotiwala» instead of the Cyrillic «Чотивала».
- **Meaning.** "local travellers" means Indian tourists, so «местных путешественников» became «индийских туристов». "Kedarnath's roadhead" (previously a vague «конечная точка») became «где заканчивается автодорога». The 2027 Kumbh is now «одно из величайших собраний индуизма — Кумбха-мела».
- **Jokes and tone.** On the 404 page, «Последний раз её слышали в палатке бюро находок» became «Последний раз её объявляли по громкой связи в бюро находок Харидвара», which fits the Kumbh "lost twin" gag. Chotiwala's «да тут рядом, минут пять ходу» now sounds like the spoken phrase. The list-your-homestay headline is now «Давайте сделаем так, чтобы номера не пустовали». The rental page heading is «Колёса в Ришикеше — без сюрпризов». The expressway elephants joke, «у улочек свой характер», «улочки всё равно победят» and «без цирка с разворотами» already worked and were kept.

### Still uncertain
- "Expressway" is «хайвей» throughout, kept for consistency. «скоростная трасса» would be more formal; switching means about 25 edits on the driving page.
- "Kumbh" is declined as a feminine noun («Кумбха / Кумбхи / Кумбху»), as some Russian sources do; others use the masculine «Кумбх». It is consistent within the file.
- Hindu calendar names (Мауни-амавасья, Нав-самватсар…) are transliterated. A specialist might hyphenate them differently.

## German (de) translation notes
<a id="de"></a>

### Translator's notes (first pass)

- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json present, no extras; tags/placeholders checked (same count and order); ₹ amounts, phones, emails unchanged. Valid JSON.
- Informal "du" throughout (standard for German travel sites), including the host page.
- River is "der Ganges" in running text; "Ganga Aarti" kept as the ceremony name; "Ganges-Ghat", "Gangesblick".
- "die Kumbh Mela" (feminine, as in German media); dates as "14. Januar 2027", weekdays in German; times 24h ("10:00 Uhr", "22:00–7:00 Uhr").
- Place names kept in Latin script, the way German travellers write them (Rishikesh, Haridwar, Laxman Jhula, Triveni Ghat, Har Ki Pauri…); temples written in the "Neelkanth-Mahadev-Tempel" style.
- Homestay kept as "Homestay" (common loanword); 3BHK explained as "mit 3 Schlafzimmern" except in the property name.
- Scooty = "Roller"; "starting ₹700 onwards" = "ab ₹700"; lakhs = "Hunderttausende".
- Jokes rewritten for German: 404 ("Status: vermutlich erleuchtet", traveller "dreht die Karte zum dritten Mal um"), elephants "Wink ruhig. Zurückwinken werden sie nicht.", "Die Gassen haben ihren eigenen Kopf", chai headline "geregelt, bevor dein Chai kalt ist", small aside on German Bakeries.
- Hindi mantras (ॐ नमः शिवाय, हर हर गंगे) left in Devanagari, as in English.

### Copy-edit pass (native German review, 2026-10-06)

**What was checked:** all 1,540 strings on all 15 pages, read side by side with the English: grammar, natural phrasing, meaning (back-translated where in doubt), tone and jokes on the 404 page, the driving guide, the rental page and the asides, consistent terms, du/ihr consistency, and the items that must not change. After editing, a script compared every string with the English again: same tags, `<n>` markers, `{placeholders}` and entities in the same order, and the same ₹ amounts, phone numbers and email addresses. 0 mismatches; every id is present. The file is valid JSON, written with the same 2-space formatting.

**Overall:** the first pass was good: correct grammar, mostly idiomatic, and the jokes already worked in German. **70 ids changed (70 strings; ids shared across pages were fixed everywhere they appear).**

#### Wrong meaning (fixed)
- Makara Sankranti, "solar transition": was "Sonnenwende" (solstice), which is factually wrong. Now "Eintritt der Sonne in den Steinbock".
- Driving guide, "the cafes are half the fun": was "die halbe Miete" (which means "half the battle"). Now "die Cafés machen den halben Spaß aus".
- Kedarnath, "nights are near freezing": "fast frostig" was vague. Now "fallen die Temperaturen nachts fast auf den Gefrierpunkt".

#### Grammar and consistency
- "beim Kumbh Mela" → "bei der Kumbh Mela" (404 page; the rest of the file uses the feminine).
- "Lord Vishnu" → "dem Gott Vishnu" ("Lord" is not used in German).
- "Hindu-Kalender" → "hinduistischer Kalender" (2×).
- "Rikscha" for "auto" → "Autorikscha", the term used everywhere else (2×).
- Advaitam "Why groups choose this home" switched from "du" to "ihr" in mid-paragraph. It now uses "ihr" throughout, since it addresses the group.
- "Privates Luxus-3BHK" → "Privates Luxus-Apartment (3BHK)".

#### Unnatural or translated-sounding phrasing (examples)
- "einen gemütlichen Block für Café oder Spaziergang" → "etwas Zeit zum Trödeln im Café oder am Fluss".
- "Das Tor nach Garhwal planen" → "Weiterreise nach Garhwal planen".
- "4 Tage möglich: 15. Januar freinehmen" → "Für 4 freie Tage: 15. Januar freinehmen" (4×).
- "Mitten in der Woche" → "Unter der Woche" (2×).
- "Unterkunft zur Aufnahme anmelden" → "Unterkunft jetzt anmelden"; "Die Bewerbung kostet keine Eintragsgebühr" → "Die Bewerbung ist kostenlos".
- "Unsere Anforderungen sind kurz und ehrlich" → "Unsere Kriterien sind wenige, aber klar".
- "Wach mit hellem Blick auf Ganges und Hügel auf" → "Aufwachen mit hellem Blick auf Ganges und Hügel".
- "Redaktionelle Darstellung/Ansicht" and "Illustrierte Szene/Moment" in image alt texts → "Illustration: …" or a plain description.
- "Taxi- & Fahrdienstbuchungen" → "Taxis mit Fahrer"; the rental meta description "Abholung … nach Haridwar und Kedarnath" was a broken list and is now "Abholungen … sowie Fahrten nach Haridwar und Kedarnath".
- Repetitive "Nach Einbruch der Dunkelheit: … vor Einbruch der Nacht" → "Im Dunkeln: Plane … so, dass du vor Einbruch der Nacht zurück bist".

#### Tone and jokes sharpened
- Haridwar lanes: "die Gassen gewinnen" → "gegen diese Gassen hast du keine Chance".
- "ein einziger böser Stau kann die Antwort umdrehen" → "… kann alles auf den Kopf stellen".
- Rental CTA "Somewhere to park the bike tonight?" → "Wo parkst du heute Nacht das Motorrad?" (was the flat "Noch einen Platz fürs Motorrad heute Nacht?").
- Host page: "Lass uns deine Zimmer füllen." → "Wir füllen deine Zimmer."; "das Verhalten der Reisenden" → "wie Reisende ticken".
- German Bakery aside: "Nein, Laugenbrezeln gibt’s trotzdem nicht."

### Still uncertain / for the owner
- **German Bakery aside:** "(Ja, „German“. Nein, Laugenbrezeln gibt’s trotzdem nicht.)" is a joke the translator added; the English doesn't have it. It fits the site's voice and German readers will get it, but remove it if translations should add nothing.
- **"du" on the host page:** some German business pages would use "Sie". "du" is kept for one consistent voice.
- **₹ grouping:** amounts keep the English digit grouping (₹1,000) as required. A German reader might read it as 1.0. The amounts are unambiguous in context.
- **"Bike":** translated as "Motorrad" (in Indian usage "bike" means motorbike). The nav label "Motorrad & Taxi" is slightly longer than the English.
- **Kumbh dates and tithi names** are copied from the English and are not checked against an official source; that is a content question, not a translation one.

## Italian (it) translation notes
<a id="it"></a>

### Translation pass (summary)
- 15 pages, 1,540 ids (1,035 unique strings); all present, none empty.
- Voice: informal "tu" throughout (normal for Italian travel sites). Quirky lines were rewritten, not translated literally.
- Kept unchanged: property, cafe and temple names, brands, ₹ prices (incl. "₹1,000" as in the source), phones, emails, URLs, festival/tithi names, and the Hindi/Sanskrit lines.
- Place names: Rishikesh, Haridwar, Laxman/Lakshman Jhula (as in the source), Triveni Ghat. "Ganga" becomes "Gange" in running text but stays in fixed names (Ganga Aarti, Advaitam Ganga & Hill View). Valley of Flowers is "Valle dei Fiori (Valley of Flowers)".
- Formats: Italian dates, decimal comma (2,5 km, ★5,0), 24-hour times.

### Copy-edit review (native strict pass)
I read every one of the 1,035 unique EN/IT pairs side by side, page by page. I checked grammar, natural phrasing, meaning (back-translating any line I doubted), jokes, consistent terms and tu/voi, and protected tokens.

**46 strings changed** (46 ids, one page each). Nothing else needed fixing: the base translation was already fluent.

- **Jokes sharpened (5):**
  - 404: "a cinque minuti da qui" became "solo cinque minuti più avanti", which matches the "just 5 minutes ahead" running gag.
  - 404: the rafters line now reads "i ragazzi del rafting partiti a cercarla si sono già ribaltati due volte".
  - "the lanes have opinions" was flat as "i vicoli hanno le loro idee". It is now "i vicoli hanno un caratterino".
  - The tyres joke now reads "ci crederemo *solo* quando ci passeremo sopra con le nostre gomme".
  - The chai line is now "tutto sistemato davanti a un chai".
- **Wrong or shifted meaning (8):**
  - "Choose your homestay base" was rendered as "the base of your homestay". It is now "Scegli la zona del tuo homestay".
  - "Match your trip style" is now "Scegli in base al tuo stile di viaggio".
  - "Stay 5+ days" had been turned into "5 notti". It now says "almeno 5 giorni".
  - "15% off stays of 5+ days" is now "da 5 giorni in su".
  - "headstreams" had been translated with the odd "rami sorgentiferi". It is now "fiumi che danno origine al Gange".
  - "temple sunrise" is now "l'alba vista da un tempio in collina".
  - "a respectful place" is now "un posto adatto, senza disturbare".
  - "Open to suggestions" was a gendered "Aperto a…". It is now "Nessuna preferenza, consigliatemi voi".
- **"Reported" dates (Kumbh, 10 strings):** "date riportate" sounds like a calque. It is now "previste", "indicate finora" or "queste date circolano già, ma non sono ancora confermate".
- **Awkward or repetitive phrasing (10):**
  - "Scegli la base in base a…" (twice) is now "a seconda di…".
  - "Il ciclo del Kumbh e il posto del 2027" is now "…e dove si colloca il 2027".
  - "In un giorno di grande bagno" is now "Nei giorni dei grandi bagni sacri".
  - "senza sbagliare una sola svolta" is now "nemmeno una curva".
  - "Moto con le marce, da tutti i giorni" is now "Moto con il cambio, pensate per l'uso quotidiano".
  - "Momento illustrativo" is now "Scena illustrativa".
  - The "Amato dagli ospiti… gli ospiti" repetition is fixed.
  - The 404 link is now "Vedi luoghi e caffè".
  - The stat tile "Locali / guide incluse" is now "Guide / sulla zona incluse".
  - "tempo di risposta che ci diamo" is now "il nostro obiettivo di risposta".
- **Short UI and CTA (6):**
  - "Go live" was "Online" and is now "Vai online".
  - "Traveller-matched leads" is now "Richieste mirate".
  - "Find nearby stays" is now "Trova alloggi qui vicino".
  - "See quiet stays" is now "Vedi gli alloggi tranquilli".
  - "Arrived!" was singular "Arrivato!" and is now "Arrivati!".
  - "About Rishikesh & Haridwar" is now "Scopri Rishikesh e Haridwar", consistent with the About page name.
- **tu/voi consistency (3):** three strings mixed "Dicci… (tu)" with "preferite / cercate / vi risponderemo". They are now all "tu". The plural "voi" is kept only where the whole group is addressed on purpose (Advaitam: "Cucinate insieme", "Rilassatevi insieme"). It is also kept in "Potete organizzare…?", where the guest is addressing our team.

### Verification
- `JSON.parse` passes. Pages and ids are identical to en.json, in the same order, and none are empty.
- `<n>`, `<n/>`, `{..}` and entities match en.json in count and order in all 1,540 strings (0 mismatches).
- File formatting is unchanged (2-space indent). The diff touches only the 46 edited values.

### Still uncertain / for the owner
- Temple and site names are mostly left in English ("Neelkanth Mahadev Temple", "Kunjapuri Devi Temple"). An Italian guide might write "il tempio di Neelkanth Mahadev". I kept them as proper names for consistency with maps and booking sites.
- "aarti" / "Ganga Aarti" is treated as masculine ("il Ganga Aarti"). Usage in Italian varies (some sources write "la Ganga Aarti", for "la cerimonia"). It is consistent across the file.
- "caffè" is used for "cafe". "café" is also seen on Italian sites. I kept "caffè" as the more natural word.
- "₹1,000" keeps the English thousands comma, as in the source. Italian style would be "₹1.000", but price strings were not to be changed.

## Japanese (ja) copy-edit QA
<a id="ja"></a>

### What I checked
- I read every page in full, all 15 pages and all 1,035 unique ids, side by side with `en.json`. I looked for grammar errors, wording that reads like a translation, wrong meaning, jokes that fell flat, inconsistent terms, wrong script and anything translated that should have stayed as it was.
- Shared ids appear on more than one page. Each one has the same value everywhere: 0 inconsistencies before the edit and after it.
- A script compared every edited string with the English. Tags `<n>`/`<n/>`, `{placeholders}`, entities, ₹ amounts, phone numbers, emails and URLs all have the same count and order. The pages and ids exactly match `en.json`, and the file passes `JSON.parse`. The 2-space format and trailing newline are unchanged.
- Kept as they were (correct): property, cafe and brand names in Latin script, the Devanagari mantras and the "© … All Rights Reserved." line. Place names are in standard katakana (リシケシュ, ハリドワール, トリヴェーニー・ガート …). The river is ガンジス川 and the ceremony is ガンガー・アールティ throughout.

### Changes: 68 strings (out of 1,035 unique)
The translation was already good overall. The edits fall into five groups:

1. **Wrong meaning (5)**
   - `ba5930c61089`: "private home" had become 一軒家 (detached house), but the property is a flat. Now 貸切の住まい.
   - `829d6c7bc9bf`, `08bd001e4632`, `b8e36c8257ed`: "apartment" was アパート, which suggests a cheap rental block in Japanese. Now マンション, which fits a luxury 3LDK.
   - `3cd6bac88f1d`: "railway-road access" was 鉄道道路. It is the street called Railway Road, so now レイルウェイ・ロード.

2. **Unnatural or translated-sounding wording (about 40)**, for example:
   - 聖地 used twice in one sentence (`e40e6f8bdc53`).
   - 手頃なシンプルな宿 → 手頃でシンプルな宿.
   - 部屋の先まで計画しよう → 宿の外での過ごし方も計画しよう.
   - 「どこに泊まるのがいつ便利か」, rewritten.
   - 天文学的・太陰暦的に正しい瞬間に → 星と月の巡りが定める吉祥の時に.
   - 予備電源の必要性 → 予備電源が必要かどうか.
   - ここに泊まって、あそこへ行く → 泊まる場所と行く場所をセットで.
   - 融通の利く拠点 → 予定を変えやすい拠点.
   - 同じガートを共有する → 同じガートに居合わせる.

3. **Jokes and voice made sharper (10)**
   - 404 page:
     - Chotiwala's 「5分も行けばすぐだよ」.
     - 「2回も転覆しました」.
     - The Bollywood twin line, which said 生き別れ and 離ればなれ (the same idea twice). It now reads ボリウッド映画のお約束どおり…双子の片割れと生き別れに.
     - The button 「待って、ここにいたい」.
   - Driving guide:
     - 「車で乗り込もうなんて考えないこと。路地には絶対に勝てません。」
     - The chai sellers are now やる気満々のチャイ売り.
     - The Friday-evening line was split into two punchier sentences.
     - The last kilometre is now 「道中いちばん楽な区間になりますよ」.
   - Rental page: the scooter line is now 「元気に走ってくれます。カーブだけはお手柔らかに。」
   - Bike CTA: 今夜バイクを停める宿、決まっていますか？ The old version read as a parking question rather than a pitch for a stay.

4. **Short UI labels made more idiomatic (8)**:
   - Travellers: 旅行者 → 同行者.
   - Friends: 友人 → 友人同士.
   - Request shortlist → 宿の候補を依頼する.
   - Best for → おすすめ.
   - Receive bookings → 予約を受け付ける.
   - Nearby planning → あわせてチェック.
   - Layout → 間取りとベッド構成.
   - "Not the right fit?" → イメージと違いましたか？

5. **Smaller fixes**:
   - Added the missing も to the long-stay rate line on 2 ids.
   - "Advaitam ガンジス川…" now has a colon.
   - "our own homestay" was 当サイト自慢の (which adds praise). It is now 私たちが運営する.

### Still uncertain
- 3BHK → 3LDK (it stays 3BHK in the property's own name). This is right for Japanese readers, but the owner may want the Indian term kept.
- `6b21fb791ac0` "About" in the footer is 概要. If the link goes to the About Rishikesh page, リシケシュについて would be clearer. I could not see the link target from the JSON alone.
- Hindu calendar terms (マーガ月クリシュナ・アマーヴァーシャー etc.) are transliterated, which is accurate but obscure. The festival-name column next to them carries the meaning.
- アーダール for Aadhaar and ヨーグ・ナグリ・リシケシュ駅 have no settled Japanese spelling. These are reasonable transliterations.

## Korean (ko) translation notes
<a id="ko"></a>

### Translator's notes (first pass)

- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json present, no extras. Script check: tags `<n>`/`<n/>`, `{placeholders}` and entities same count and order; ₹ amounts, phone numbers and email addresses unchanged. Valid JSON, 2-space formatting.
- Polite 해요체/합쇼체 mix as used on Korean travel sites ("~하세요", "~드립니다"); short UI labels are nouns (메뉴, 홈, 문의, 숙소 찾기).
- Place names in Hangul as Korean travellers write them: 리시케시, 하리드와르, 락슈만 줄라 (Laxman/Lakshman both), 람 줄라, 트리베니 가트, 타포반, 스와르그 아쉬람, 무니 키 레티, 닐칸트 (로드), 하르 키 파우리, 케다르나트, 바드리나트, 데라둔, 졸리 그랜트 공항. AIIMS kept in Latin.
- River: 갠지스강 in running text; Ganga Aarti = "갠지스 아르티"; Kumbh Mela = 쿰브 멜라; snan = 스난 (with 목욕일 where it reads better).
- Kept in Latin script: stay/property names (Advaitam Ganga & Hill View…), cafe/restaurant names on the places page (Little Buddha Cafe, Chotiwala…), brands (WhatsApp, Airbnb, Booking.com, MakeMyTrip, Royal Enfield, FASTag, Zomato, Swiggy, Blinkit, Rajmargyatra), Hindi mantras in Devanagari.
- Dates in Korean order ("2027년 1월 14일", "목요일"); "starting ₹700 onwards" = "₹700부터"; lakhs = 수십만 명; scooty = 스쿠터; tempo traveller = 템포 트래블러(승합차); 3BHK kept, explained as 침실 3개 where it is a feature.
- Jokes rewritten for Korean: 404 ("경로 상태: 기분 좋게 길 잃음", "현재 상태: 아마도 해탈", Kumbh twins "발리우드 영화처럼 생이별", "미아 보호소 텐트"), elephants "코끼리가 답례하진 않겠지만요", "골목에도 고집이 있습니다", "그 골목들을 이길 수는 없습니다", spur road "저희 차 타이어가 직접 닿아 보기 전까지는 믿지 않으려고요", chai headline "차이 한 잔 마시는 사이에 해결".
- Copyright line: "All Rights Reserved." translated as "모든 권리 보유."

### Still uncertain / for the owner

- "The 60's Cafe (The Beatles)" and other cafe names left in English; the descriptions name them in Korean context.
- Kumbh tithi names are transliterated (마가 크리슈나 아마바스야 …); Korean readers won't know them, but they are labels, not prose. Makara Sankranti explained as "태양이 염소자리로 들어가는 날".
- ₹ amounts keep English digit grouping (₹1,000), which is also the Korean convention.

### Copy edit (second pass, native Korean review)

**What was checked:** all 15 pages, every one of the 1,035 unique English/Korean pairs (1,540 strings incl. repeated header/footer) read side by side; doubtful lines back-translated. Checked grammar, naturalness, meaning, jokes, term consistency, script (no stray kana/hanzi; only brand/property/cafe names, units and codes left in Latin), and that names, ₹ amounts, phones, emails, URLs and `<n>` tags/placeholders are unchanged (automated check: same pages and ids, same tag/placeholder sequence and same numbers/emails in every string, valid JSON).

**Verdict on the first pass:** high quality: natural 해요체/합쇼체, jokes already localised well (404, elephants, spur road, lanes "고집"). Changes were polish, not rescue.

**Lines changed: 40 unique strings (68 including repeats of the shared header/footer across pages).**

- Jokes/voice (404): "이정표조차 … 의견이 갈리네요" → "갈팡질팡하네요" (one signpost can't disagree with itself); "현재 상태: 아마도 해탈" → "해탈한 것으로 추정됨" (keeps the deadpan police-report tone of "presumed"); "잠깐, 여기 좋은데요" → "잠깐만요, 여기 마음에 드는데요".
- Grammar: "인도에서 ❤️을 담아" (particle after emoji reads wrong) → "인도에서 ❤️ 담아 만들었습니다".
- Meaning: Haridwar aarti "louder, larger" had lost "louder" (웅장하며) → "더 떠들썩하고 규모도 크며" (about-rishikesh and the Kumbh page); "Car or taxi" was 자가용 (one's own car) → 승용차 on the Triveni Ghat page (자가용 kept where English says "private car"); "Parking on premises" 건물 내 주차 → 숙소 내 주차; "Leave before dawn" 새벽 전에 (odd) → 동트기 전에 (2).
- Unnatural phrasing: "숭배받는 시바 사원" → "참배객이 끊이지 않는 시바 사원" (2); "Context:" label "한마디:" → "소개:" (6 season/time cards); 404 card kickers 탐험/발견 → 체험/탐방; traveller filter "전체" → "유형 무관", "친구" → "친구끼리"; "추천 받을게요" → "추천해 주세요"; "가르왈 관문 여행 계획하기" → "가르왈 여행 계획하기"; "다른 예약 사이트" → "다른 사이트에도 등록되어 있어요"; kicker "여행자의 선택을 돕기 위해" → "여행자의 선택을 돕는 정보"; "리시케시에서 케다르나트 순례" (title/link read as "a pilgrimage held in Rishikesh") → "리시케시–케다르나트 순례" / "리시케시 출발 케다르나트 순례".
- Transliteration: Bajrang 바지랑 → 바즈랑 (2); Trayambakeshwar 트람바케슈와르 → 트라얌바케슈와르 (2).
- Consistency: "&" between Korean words → "·" as elsewhere on the site (식당·카페, 케다르나트·가르왈, 리시케시·하리드와르 소개, 탈리·남인도 음식, Royal Enfield·히말라얀급).

**Still uncertain:**
- "© … 모든 권리 보유." is correct but many Korean sites leave "All rights reserved." in English; either is fine.
- Property names are kept in English inside Korean sentences ("저희 Advaitam Ganga & Hill View homestay는"); readable, but the owner may prefer "Advaitam 홈스테이" in running text.
- Hindu calendar/tithi names remain transliterations (unfamiliar to Korean readers, but they are labels).

## QA notes: Indonesian (id)
<a id="id"></a>

### Translation (from the translator)

- Coverage: 15 pages, 1,540 ids, all present; JSON parses; every `<n>`/`<n/>` tag, {placeholder} and entity matches en.json in count and order; ₹ amounts, phone numbers, emails and URLs unchanged.
- 148 values are deliberately identical to English: property, cafe and brand names, place names, Hindu calendar names, "Menu", "Email", "Check-in/Check-out", "Workation", and dates like "7 April 2027".
- Terms: homestay (kept), "penginapan" for stay/stays, "skuter matik" for scooty, "mobil lepas kunci" for self-drive car, "SIM" for driving licence, "Sungai Gangga" for the river (kept as "Ganga" inside names such as Ganga Aarti), "Kuil X" for temples, "Air Terjun X" for waterfalls.

### Copy edit (native-speaker review, 2026-10-06)

**What I checked:** I read all 1,540 strings on all 15 pages against the English, one shared id at a time (ids repeated in headers and footers were checked once and fixed everywhere). I looked at grammar, unnatural or literal phrasing, meaning (I back-translated the lines I was unsure of), whether the jokes still land, consistent terms, the "Anda" register, and that names, prices, phone numbers, URLs and tags were left alone.

**Overall:** the translation was already good: grammatical, natural and consistently polite. Most of the jokes already worked: the expressway elephants that won't wave back, "gang-gangnya punya pendapat sendiri", "kamera tilang", "tanpa drama mundur-maju" and "beres sambil menyeruput segelas chai".

**Changed:** 45 unique ids, which is 46 values across the pages. Main reasons, with examples:

- **Jokes made sharper**
  - 404: "Bahkan papan penunjuk jalan pun tidak sepakat…" became "Papan penunjuk jalannya saja tidak kompak soal ke mana perginya." A single signpost can't "disagree" with itself.
  - Kumbh "lost-and-found tent": "tenda barang hilang" became "posko orang hilang". That is what the twins-separated-at-Kumbh joke refers to.
  - "Possible sighting" became "Katanya sempat terlihat".
  - Kumbh stay advice: "a grand hotel you can't drive out of" was a clumsy literal line. It is now "hotel megah tempat mobil Anda terkurung seharian".
  - "Royal Enfield country starts…" became "di situlah wilayah kekuasaan Royal Enfield dimulai".
- **Literal or awkward phrasing**
  - "Cara kerja Kumbh" became "Seluk-beluk Kumbh".
  - "Ketahui apa yang bisa diharapkan…" became "Gambaran suasana Ganga Aarti…".
  - "Atur hari-hari Anda" became "Susun rencana harian Anda".
  - "Tujuan yang berguna" (an aria label) became "Tautan bermanfaat".
  - "Menginap di dekat mana?" became "Sebaiknya menginap di mana?".
  - "Perencanaan di sekitar" became "Rencana di sekitarnya".
  - "Tidak bawa" (pets dropdown) became "Tanpa hewan peliharaan".
  - "budget sederhana" became "yang hemat dan sederhana".
- **Wrong or unclear meaning**
  - Vegetarian tip: "lebih baik direncanakan sejak awal daripada dilawan" had no clear subject. It now reads "sebaiknya sesuaikan rencana Anda dengan hal ini, bukan melawannya".
  - "tempat ratusan ashram" became "rumah bagi ratusan ashram".
  - "satu malam aarti" became "satu sore menyaksikan aarti", since aarti is at dusk.
  - "pantai sungai" became "tepian sungai berpasir".
  - Rafting "pantai-pantai rafting" became "tepian pasir tempat start rafting".
  - "berapa kali perjalanan yang terpakai" became "berapa jatah perjalanan yang akan terpakai".
  - "sebelum tiba" became "sebelum Anda tiba", so it is clear who is arriving.
- **Word choice**
  - "kebaktian" (it sounds like a church service) became "bhakti", "pengabdian spiritual" or "musik rohani".
  - "Motor bergigi" became "motor kopling", the normal Indonesian word.
  - "kafe-hopping" became "cafe hopping".
  - "kroket" became "cutlet" (the Indian cutlet is a different dish).
  - "mempersatukan" became "mempertemukan".
- **Number format**
  - The Airbnb rating "5.0" is now "5,0" (★5,0), to match the Indonesian decimal comma used everywhere else.

All tags, placeholders and entities were re-checked by script after the edits (0 mismatches). The file parses with `JSON.parse`.

### Still uncertain

- "Pertanyaan" is used for "enquiry" throughout ("Kirim pertanyaan"). It is correct and consistent, but some Indonesian travel sites would say "permintaan" or "Kirim permintaan". I left it as it is for consistency.
- "bajaj (auto-rickshaw)" is explained once, and "auto-rickshaw" is used everywhere else. That is fine for Indonesian readers, but the owner may prefer one form throughout.
- ₹ amounts keep the English thousands comma (₹1,000) as the brief asks. Indonesian readers would normally write 1.000, so that line may look slightly foreign to them.
- "Workation", "staycation", "cafe hopping", "food court" and "rest area" are kept in English. They are common in Indonesian web copy.

## Malay (ms, Malaysian) translation notes
<a id="ms"></a>

### First pass
- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json present, same order, no extras. Valid JSON.
- Script check against English: same `<n>`/`<n/>` tags, `{placeholders}` and entities in the same order; same ₹ amounts, phone numbers and email addresses. 0 mismatches.
- Register: standard Malaysian Malay with "anda" throughout (normal for travel/booking sites); short UI labels kept short (Menu, Utama, Hubungi, Tempah, Cari penginapan, Hantar pertanyaan).
- "Homestay" kept as the loanword (it is everyday Malaysian usage); "Workation", "Solo", "Scooty", "auto-rickshaw", "e-rickshaw", "tempo traveller", "dhaba", "thali", "aarti", "ghat", "ashram", "sadhu", "akhara", "snan", "yatra", "darshan" kept as the local terms travellers use.
- River: "Sungai Ganga" in running text; ceremony name "Ganga Aarti" and place names "Ganga Ghat"/"Ganges Ghat" kept. Temples as "Kuil Neelkanth Mahadev", waterfalls as "Air Terjun Neer Garh", "Taman Negara Rajaji". Place names in Latin script as written in English (Rishikesh, Haridwar, Laxman/Lakshman Jhula, Triveni Ghat, Har Ki Pauri…).
- Months in Malay (Januari, Februari, Mac, Ogos…), weekdays in Malay; times as "10:00 pagi", "10:00 malam".
- "Bike" = motosikal (Indian usage means motorbike); "cab" = kereta sewa; "outstation" = luar kawasan; "lakhs" = "ratusan ribu".
- Property/cafe/brand names unchanged (Advaitam Ganga & Hill View Luxury 3BHK, Little Buddha Cafe, Chotiwala, Booking.com, Airbnb, MakeMyTrip, Zomato, Swiggy, Blinkit, FASTag, Rajmargyatra…). Airbnb badge "Guest Favourite" left in English as Airbnb shows it.
- "Editorial/Illustrative view of…" alt texts rendered as "Ilustrasi …" or a plain description.
- Makara Sankranti "solar transition" = "matahari memasuki buruj Jadi" (sun entering Capricorn), not "solstis".
- Jokes rewritten for Malay readers: 404 ("Status laluan: sesat dengan gembira", "mandi-manda di Sungai Ganga dan tak pulang-pulang", "dipercayai sudah mencapai pencerahan", Bollywood twin "macam dalam filem Bollywood"), elephants "Lambaikan tangan kalau mahu. Mereka tak akan membalas.", Haridwar lanes "anda takkan menang melawan lorong-lorong itu", parking heading "lorong-lorongnya ada kehendak sendiri", rental headline "selesai sebelum chai anda sejuk", spur road "kami hanya akan percaya apabila tayar kereta kami sendiri menyentuhnya".
- Hindi mantras (ॐ नमः शिवाय, हर हर गंगे) left in Devanagari, as in English.

### For the owner
- ₹ amounts keep the English digit grouping (₹1,000), which is also how Malaysians write numbers; decimals use a point (2.5 km), also standard in Malaysia.
- Hindu festival/tithi names (Mauni Amavasya, Vasant Panchami…) left untranslated, as they are proper names; Kumbh dates copied from the English, not checked against an official source.
- "Kumbh 2027" nav label and "Menu" are identical to English by design.

### Copy-edit pass (native Malaysian Malay review)

#### What was checked
- Every unique EN/MS pair on all 15 pages (404, index, thanks, contact, homestays, about-rishikesh, places-to-visit, things-to-do, triveni-ghat, kedarnath-yatra, haridwar-kumbh-2027, list-your-homestay, driving guide, bike & taxi rental, Advaitam property page), read side by side for grammar, natural phrasing, meaning (back-translated where unsure), joke delivery, term consistency, and anything that must stay unchanged.
- Re-ran a script check after editing: same pages and ids in the same order as en.json, 1,540 strings, 0 mismatches in `<n>` tags, `{placeholders}`, entities, ₹ amounts, phone numbers and email addresses. Valid JSON.

#### Changes: 34 unique strings (48 lines in the file, as some strings repeat across pages)
- Wrong or loaded religious terms: "berhala" (idol, pejorative in Malaysian usage) -> "arca" / "arca dewa" (Bharat Mandir, Kedarnath); "paderi" (Christian clergy) -> "pendeta" for the Har Ki Pauri priest families (2 pages); Vishnu "muncul ... kepada seorang pertapa selepas tempoh bertapa" -> "menampakkan diri ... kepada seorang resi selepas lama bertapa"; "orang awam" for householders -> "golongan berumah tangga".
- Meaning fixes: "catatan hari bekerja" (= working-day note) -> "catatan praktikal tentang hari dalam minggu" (weekday note in the Kumbh table); "banjir kilat" (flash flood) -> "jalan dinaiki air" (waterlogging); "bertukar tangan" (calque) -> "bertukar pemilik"; "Kami memanjangkan pertanyaan" -> "Kami menyalurkan pertanyaan"; "Pemindahan ke Haridwar" (sounds like relocation) -> "Perjalanan ke Haridwar"; "kuih-muih bakar" -> "pelbagai hasil bakeri".
- Unnatural/machine phrasing smoothed: "kawasan mana sesuai untuk menginap bila" -> "kawasan terbaik untuk menginap mengikut tujuan perjalanan anda"; "yang hanya sebentar memandu dari situ" -> "yang tidak jauh dari situ dengan kereta"; "Sediakan satu aktiviti..." -> "Peruntukkan masa untuk..."; "Rancang matahari terbit di Kunjapuri" -> "Rancang lawatan matahari terbit ke Kunjapuri"; "rafting sungai di Sungai Ganga" (repetition); "Menginap berhampiran yoga" -> "berhampiran pusat yoga"; "Memasak bersama, gunakan..." (mixed forms) -> "Masak bersama-sama, jadikan..."; "pagi berkopi" -> "pagi dengan kopi"; "asas rujukan" -> "atas dasar rujukan"; "Mula disiarkan" -> "Mula disenaraikan"; "Jangan lepaskan" (incomplete) -> "Wajib dikunjungi"; nav card "Menginap" -> "Penginapan" to match its sibling labels (Teroka, Temui).
- Jokes sharpened: 404 "sesat dengan gembira" -> "sesat, tapi bahagia"; "Kali terakhir didengar" -> "Kali terakhir dikesan" (reads like a missing-person notice); Kumbh "hotel mewah yang kereta anda tak dapat keluar" (broken) -> "bilik ringkas yang membolehkan anda terus berjalan kaki ke ghat lebih baik daripada hotel mewah yang kereta anda pun tak boleh keluar"; driving guide "tanpa drama mengundur" -> "tanpa drama undur-mengundur".
- Left as the translator had them (already natural): elephants "Mereka tak akan membalas", "lorong-lorongnya ada kehendak sendiri", "anda takkan menang melawan lorong-lorong itu", "selesai sebelum chai anda sejuk", "kami hanya akan percaya apabila tayar kereta kami sendiri menyentuhnya", "kamera laju akan uruskan selebihnya".

#### Still uncertain
- "Homestay" vs "inap desa": kept the loanword, which is what Malaysian booking sites use; "inap desa" would sound like an official programme.
- "Neelkanth Road" and "Ganges Ghat" are left in English as place/label names; a local might write "Jalan Neelkanth", but the English form matches signage and maps.
- The rental page's "Advaitam Ganga hill-view 3BHK" link text is rendered with the property's full name ("Advaitam Ganga & Hill View 3BHK"). Same property, so this is harmless, but it is not word for word.
- "Kawan-kawan" vs "rakan-rakan": both are natural. Kept "kawan-kawan" for the friendly tone.

## Turkish (tr) translation notes
<a id="tr"></a>

- 15 pages, 1,540 strings (1,035 unique ids; ids shared across pages get one identical translation). Every id from en.json is present, with no extras. Valid JSON (2-space format).
- A script compared every string with the English: the same `<n>`/`<n/>` tags, `{placeholders}` and entities in the same order, and the same ₹ amounts, phone numbers, emails and URLs. 0 mismatches.
- Address: polite "siz" throughout. Turkish booking and travel sites (Booking.com TR, Airbnb TR) use it. Short UI strings follow Turkish web conventions: "Menü", "Ana Sayfa", "Menüyü aç", "Talep gönder", "İsteğe bağlı", "Giriş/Çıkış" for check-in/out.
- Homestay → "ev pansiyonu" (plural "ev pansiyonları"). The brand "Rishikesh Homestays" is unchanged. Workation → "iş + tatil". Scooty → "scooter". Auto-rickshaw → "otoriksa", e-rickshaw → "e-rikşa". Tempo traveller is kept and explained as "minibüs".
- River: "Ganj" in running text (the standard Turkish name, with suffixes Ganj'da, Ganj'ı). "Ganga Aarti" and "Ganga & Hill View" are kept as the ceremony name and the property name.
- Place names stay in Latin script as travellers write them (Rishikesh, Haridwar, Laxman/Lakshman Jhula as in the source, Triveni Ghat, Har Ki Pauri, Neelkanth Yolu, Swarg Ashram). Turkish case suffixes take an apostrophe and follow vowel harmony (Rishikesh'te, Haridwar'da, Triveni Ghat'ta, AIIMS'e). Generic words are translated (Tapınağı, Şelalesi, Aşramı, Ulusal Parkı). Proper ashram names such as Swarg Ashram and Sivananda Ashram are kept.
- Dates use the Turkish format ("14 Ocak 2027", Turkish weekday names). Month ranges without a day are lowercase per TDK ("ekim-mart"). Times are 24h ("10:00", "22:00–07:00"). Decimals use a comma ("2,5 km", "9,1 milyon") and thousands a dot ("3.583 m"). ₹ figures are copied exactly ("₹1,000").
- Hindu calendar names (tithi, snan names), the Devanagari mantras, cafe names, Advaitam names and brand names are unchanged. Makara Sankranti's "solar transition" is rendered correctly as "Güneş'in Oğlak burcuna geçişi", not as solstice.
- The jokes are rewritten for Turkish readers:
  - 404 page: the traveller "haritayı üçüncü kez ters çeviriyor"; "Chotiwala abimiz" swears it is "şuracıkta, beş dakika ileride"; "Durum: muhtemelen aydınlanmaya ermiş".
  - Elephants: "İsterseniz el sallayın. Onlar size el sallamayacak."
  - "Rishikesh'te park: sokakların kendi fikri var".
  - Haridwar lanes: "o sokaklarla inatlaşan hep kaybeder".
  - Spur road: "kendi lastiklerimiz o asfalta değmeden inanmayacağız".
  - Chai headline: "bir çay içimi sürede halledilir".
- Points to check: "3BHK" is kept in property names and is explained once as "3 yatak odalı daire". Lakhs → "yüz binlerce". OTT apps → "dijital platform uygulamaları".

### Copy-edit pass (native Turkish review, 2026-10-06)

**What was checked:** all 1,035 unique ids (1,540 strings on 15 pages) were read side by side with the English, looking at grammar, natural phrasing, meaning (doubtful lines back-translated), whether the jokes still land, consistent terms, and unchanged names, prices, phones, emails, URLs, tags and placeholders. Afterwards a script confirmed that every page and id matches en.json, with no gaps or extras, and that the tags, `{placeholders}`, entities, ₹ amounts, phone numbers and emails are the same and in the same order (0 mismatches). The file parses as valid JSON.

**Result:** the draft was already good. 30 unique ids were edited (31 strings, since one id appears on two pages). The reasons:

- **Grammar and spelling:** "terasler" became "teraslar". "Neden Rishikesh Homestays ile listelemelisiniz?" had no object, so it became "Tesisinizi neden Rishikesh Homestays'te listelemelisiniz?" The meta text was fixed the same way ("Tesisinizi bizde listeleyin"). The title "Rishikesh'ten Kedarnath Yatra" was missing a case ending and became "Rishikesh'ten Kedarnath Yatra'ya".
- **Unnatural or literal wording:**
  - "Hacı kasabasından" became "Hac kasabasından".
  - "Şehri koşturmadan Rishikesh'te yapılacaklar" became "Rishikesh'te acele etmeden yapılacaklar".
  - "6–8 Mart ile 3 günlük hafta sonu" became "6–8 Mart: 3 günlük hafta sonu".
  - "Gezginle eşleşen talepler" became "Size uygun misafir talepleri".
  - "Bir üsse de mi ihtiyacınız var?" became "Kalacak bir yer de mi lazım?"
  - "Tüm gruba bir arada olabileceği alanı verin" became "Bütün grup rahatça bir arada olsun".
  - "Dönüş yolunu erken tutun" became "Dönüşe erken çıkın".
  - "Rishikesh'e son bir saat" became "Rishikesh'e son bir saatlik yol".
  - The "alınma" (pickup) wording became "servis", "sizi istediğiniz yerden alır" or "Alış noktası".
  - "bacakları açmak" reads wrong in Turkish, so it became "bacakları esnetmek".
  - "akıntılar" for rapids became "azgın sular".
  - "Kumbh vesilesi" (table header) became "Kumbh günü".
- **Wrong meaning:** "small notes" had been translated as "bozuk para" (coins) and is now "küçük banknotlar". "Hot water geyser" had been translated as "şofben" (a gas heater) and is now "Termosifon" (an electric water heater). "one of the better" is now "en iyi seçeneklerden biri", which is the natural Turkish phrase. "Mobile:" is now "Cep telefonu:".
- **Voice and jokes:** the 404 line "Rota durumu: keyifle kaybolmuş" became "Rota durumu: mutlu mesut kayıp". The other jokes (the elephants, the parking lanes, the spur road, "beş dakika ileride", "aydınlanmaya ermiş") already landed and were left as they were.
- **Consistency:** the 404 card eyebrows read "Keşfet" and then "Keşfedin". The second one is now "Keşif". The "Travellers" select label is now "Seyahat grubu" rather than "Gezginler". The Airbnb rating in running text is now written "5,0", with a Turkish decimal comma. The "★5.0" badge stays as it is.

**Still uncertain:**
- "hacı" / "hac" for Hindu pilgrims is the standard Turkish word, but readers associate it with Islam. Possible alternatives are "yatrı" (too obscure) and "dindar ziyaretçi" (too long), so it stays.
- "German bakery" is kept as a loanword ("German bakery'ler"), because it names a specific Rishikesh cafe type rather than "Alman fırını". The owner may prefer the explanation "Alman usulü fırın-kafe".
- "Ev pansiyonu" for homestay is clear, though some Turkish sites just use "homestay". It is kept for readability.
- Hindu bathing-day names and the "3BHK" in property names are left unchanged as proper names.

## Vietnamese (vi) translation notes
<a id="vi"></a>

### Translator pass
- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json is present, with no extra ids. Each id has the same translation on every page it appears on.
- Checked by script: indexed tags (`<0>…</0>`, `<1/>`) are in the same count and order, and every ₹ amount, phone number, email and URL is unchanged. ₹1,000 keeps its English comma, as in the source.
- Place names are in Latin script, written the way Vietnamese travellers write them: Rishikesh, Haridwar, Laxman/Lakshman Jhula (whichever the English uses), Ram Jhula, Triveni Ghat, Har Ki Pauri, Swarg Ashram, Muni Ki Reti, Tapovan, Neelkanth. The river is « sông Hằng » (the standard Vietnamese name). The ceremony is « lễ Ganga Aarti » / « lễ aarti ».
- Words travellers already know are kept: homestay, ashram, ghat, sadhu, akhara, dharamshala, thali, dosa, chai, Char Dham, Kumbh Mela, snan/tithi names (Amavasya, Purnima…). Common words are translated: rafting → « chèo bè (vượt thác) », scooty → « xe tay ga », auto-rickshaw → « xe tuk-tuk », e-rickshaw → « xe điện ba bánh », workation → « vừa làm vừa du lịch ».
- 3BHK: when it is part of the property name it stays as is (« Advaitam Ganga & Hill View Luxury 3BHK »). In running text it becomes « 3 phòng ngủ (3BHK) ».
- Dates are written « 14 tháng 1 năm 2027 », with weekdays « Thứ Hai… », and Vietnamese decimal commas (2,5 km; 9,1 triệu). Lakhs → « hàng trăm nghìn ». 11-foot → « 11 feet (khoảng 3,35 m) ».
- Jokes are rewritten so they work in Vietnamese, not translated word for word. Examples: the 404 page « có lẽ đã giác ngộ » and the « kiểu phim Bollywood » twin; « ngõ hẻm sẽ thắng » / « ngõ hẻm cũng có chính kiến »; the elephants that « sẽ không vẫy lại đâu »; « bánh xe của chính chúng tôi chưa lăn trên đó thì chúng tôi chưa tin ».
- UI strings follow Vietnamese website conventions: Trang chủ, Menu, Liên hệ, Gửi yêu cầu, Nhận phòng/Trả phòng, Không bắt buộc, VD:.
- Mantras in Devanagari (ॐ नमः शिवाय, हर हर गंगे) and the romanised "Om Namah Shivaya, Har Har Gange" are left unchanged.

### Copy-editor pass (native Vietnamese review)
- **What I checked:** I read all 1,035 unique strings next to the English, page by page. I looked at grammar, natural phrasing, meaning (back-translating any line I doubted), the jokes, terms used the same way throughout, and things that must stay unchanged (names, ₹ prices, phone numbers, emails, URLs, `<0>…</0>` tags). After editing, a script checked that every string's tags still match the English in count and order (0 mismatches) and that the file parses with `JSON.parse`.
- **Overall:** the translation was already strong: fluent, accurate, and the 404 page, parking jokes and "elephants won't wave back" lines already worked in Vietnamese. Most strings needed no change.
- **Changed:** 24 unique strings, which is 38 lines across all pages, since shared strings (nav, footer) appear on several pages. Each was changed to the same text everywhere it appears.
  - Wrong or unclear meaning: "starter homestay listings" was « homestay đầu tiên trong danh sách » ("the first homestay in the list") and is now « homestay trong danh sách ban đầu ». "Open to suggestions" (a dropdown option) is now « Để chúng tôi gợi ý ». "Stay 5+ days" said « 5 đêm » (nights) and now says « 5 ngày », as elsewhere on the site.
  - Machine-sounding or clunky: « Đăng ký đăng chỗ ở » is now « Đăng ký đưa chỗ ở lên trang ». « Cách thức hoạt động? » is now « Hoạt động thế nào? » / « Quy trình ». « Lên sóng » (a TV/broadcast word) is now « Hiển thị trên trang ». « Thời gian lái thường gặp » is now « Thời gian lái thông thường ». « kiểu ngày tháng bạn muốn có » is now « kiểu ngày nghỉ bạn mong muốn ». « Chuẩn bị cho cửa ngõ Garhwal » is now « Lên kế hoạch đi vùng Garhwal ». « Xa hơn Rishikesh » is now « Ngoài Rishikesh ». « năm 2027 nằm ở đâu » is now « vị trí của năm 2027 ». « dạo một bậc ghat » is now « dạo dọc một bến ghat ». « chúng tôi chỉ thành công khi… » is now « chúng tôi chỉ có lời khi… ». "Made with ❤️" is now the usual « Được làm với ❤️ ».
  - Voice and jokes: "Route status: delightfully lost" is now « lạc đường, nhưng vui » (punchier than « một cách đáng yêu »). "Stay here, visit there" is now « Ở một nơi, chơi khắp nơi » (it rhymes). "Somewhere to park the bike tonight?" is now « Tối nay cần chỗ dựng xe, ngả lưng? », which keeps the hint that this is about a place to sleep.
  - Smaller fixes: « Định đi chơi vào dịp Kumbh? » is now « Định đi vào dịp Kumbh? » ("đi chơi" sounds too frivolous for a pilgrimage). « Cần cả chỗ ở? » is now « Cần cả chỗ ở nữa? ».
- **Still uncertain:**
  - Ratings are written « 5.0 » / « ★5.0 » with a decimal point to match Airbnb. Elsewhere the translation uses Vietnamese decimal commas (2,5 km), so « 5,0 » would be the strictly local form.
  - « xe tuk-tuk » for auto-rickshaw is clear to Vietnamese travellers, but it is a Thai-style name.
  - Some English loanwords are kept on purpose because Vietnamese travel sites use them (view, healthy, homestay, staycation, set ăn sáng). A more formal style would replace them.

## Hebrew (he) QA: copy-edit pass
<a id="he"></a>

### What was checked
- All 15 pages, all 1,540 ids. There are 1,035 unique English strings. Each one was read side by side with its Hebrew, and any line in doubt was back-translated.
- Checked for grammar, calques and machine-sounding phrasing, wrong meaning, flat jokes, inconsistent terms, script, and anything that must stay unchanged (names, brands, ₹ prices, phones, emails, `<n>`/`<n/>` tags).
- Ids with identical English still get identical Hebrew on every page.
- Automated check after editing: every page and id is present, and tags, ₹ amounts, phone numbers and emails match the English in count and order (0 mismatches). The JSON parses as valid.

### What changed
- 113 unique strings were rewritten, which comes to 200 ids across the pages. Everything else was already natural and correct, and was left alone.
- **Calques made idiomatic:** "ומכאן אנחנו לוקחים את זה" became "ואת השאר תשאירו לנו". "רישיקש עובדת הכי טוב" became "רישיקש הכי טובה כשהימים שלכם לא דחוסים". "בנוי בשביל ההחלטות של מטיילים" became "כל מה שצריך כדי להחליט". "איך כל אחד מהם מרגיש" became "מה מאפיין כל אחד מהם". "בחרו בסיס לפי איך שאתם רוצים שהיום ירגיש" became "לפי סוג הימים שאתם רוצים". "לעוגנים נוספים ב-2027" was reworded. "הרף שלנו קצר וכן" became "כמה דרישות פשוטות וכנות".
- **Grammar:** "גשר ההולכי רגל" became "גשר הולכי הרגל" (3 places). A subject mismatch in the German-bakery line was fixed: "מוסד ותיק… וחלקן פועלות". A doubled "ו" in "וותרו… וחזרו" was fixed. "יושב על גדת" became "שוכן על גדת". "מדט" became "ישב במדיטציה". "פנים חדר השינה" and "הפנים המשותף" were rewritten as "חדר השינה מבפנים" and "החללים המשותפים". The doubled "פשוט… יום פשוט" was removed.
- **Meaning:** "Makara Sankranti" had been written as "מקרה" (Hebrew for "incident"). It is now "מקארה". Seniors was "מבוגרים", which reads as just "adults", and is now "מטיילים מבוגרים" / "גיל השלישי". "Railway Road" had become "דרך הרכבת" and is now "ריילווי רוד". "Last heard at the lost-and-found tent" now reads "נשמע לאחרונה ברמקול של אוהל האבדות". "Arrive" was "נוחתים" and is now "מגיעים". Triveni Ghat "riverfront" is now "הגאט המרכזי" / "רחבת הנהר" instead of the literal "חזית הנהר". The Bhagirathi is now one of the Ganga's "נהרות המקור" instead of "יובלי המקור". 11 feet now also shows metres (כ-3.4 מטר).
- **Voice and jokes:** Sharpened lines: the signpost "לא מצליח להסכים עם עצמו", rafters as "החבר'ה מהרפטינג", "Half of Delhi has the same idea" as "לחצי דלהי יש בדיוק אותו רעיון", the bike-rental "sorted over one chai" as "מסודר עוד לפני שתסיימו כוס צ'אי", the Royal Enfield line "פשוט תענוג ברגע שהכביש מתחיל לטפס", and New Year as "סילבסטר" for Israeli readers. These already worked and were kept: the elephants that won't wave back, "הסמטאות ינצחו", "לסמטאות יש דעות משלהן", "נאמין כשהצמיגים שלנו ייגעו בו", "רגע, טוב לי פה", and the Israeli-food wink.
- **Short UI:** Home is now "דף הבית" and Skip to content is now "דילוג לתוכן". "Plan my stay" is now "לתכנון השהייה", because "תכננו לי שהייה" read as an order given to the user. "Explore" is now "לטייל". "Open WhatsApp" is now "פתיחת וואטסאפ". The footer label is now "ניווט בתחתית העמוד". Listings are now "מודעות" instead of "רשומות". "Bike & taxi" in the nav is now plural, matching the page title.

### Still uncertain
- **Hindu terms:** tithi, Amrit Snan and festival names (טיתי, אמריט סנאן, מאוני אמאוואסיה, נאב סמווטסאר) are transliterated. Most Israeli readers won't know them, but the English doesn't explain them either.
- **Name spellings:** Hebrew spellings of less-known places (קוביאמרק, צ'אוראסי קוטיה, טריאמבקשוור, סצ'ה אקהילשוור) are phonetic best guesses. There is no settled Israeli spelling for them.
- **Latin names in RTL text:** brand and property names stay in Latin inside Hebrew sentences (Advaitam Ganga & Hill View, Cheetal Grand, cafe names). They display correctly only if the page sets `dir="rtl"` and the browser handles the mixed direction. Strings that start with a Latin name (e.g. "Advaitam Ganga & Hill View היא…") should be checked visually.
- **Arrow:** the 404 Kumbh link uses "←" for RTL. Any other arrows the HTML adds outside the strings will need flipping in the template.
- **Units:** "5+ days" offers are rendered as "5 לילות ומעלה", which is the Israeli booking convention. Confirm with the owner that nights and days mean the same here.
- **Rendering:** I did not see the rendered pages, so line breaks and overflow in narrow RTL buttons were not checked.
