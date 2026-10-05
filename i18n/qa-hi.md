# Hindi (hi) translation QA

Scope: the 15 hand-made pages in `i18n/en.json`. That is 1,540 strings, 1,035 of them unique, about 12.5k English words. Every id has a Hindi string in `i18n/hi.json`. `node scripts/i18n/stale.mjs hi` reports 0 missing, 0 orphaned and 0 suspect: placeholders match, every English number is present and ₹ signs match.

## Method

1. I translated each unique string once into natural Hindi in a local guide's voice (Devanagari, आप form). Strings shared across pages, such as the header, footer and form labels, use the same id and so get the same Hindi everywhere.
2. In a separate pass I translated all 1,035 Hindi strings back into English, working only from the Hindi. I then compared each back-translation with the source English.
3. Every case of meaning drift was fixed in the Hindi and translated back again. The table below lists them. No drift is left.

## House style and glossary

- Place names are written as people in Rishikesh write them in Hindi: ऋषिकेश, हरिद्वार, गंगा (both "Ganga" and "Ganges"), तपोवन, त्रिवेणी घाट, स्वर्गाश्रम, मुनि की रेती, नीलकंठ रोड, लक्ष्मण झूला (both "Laxman" and "Lakshman"), राम झूला, जानकी सेतु, जानकी पुल, बजरंग सेतु, परमार्थ निकेतन, बीटल्स आश्रम, हर की पौड़ी, ब्रह्मकुंड, निर्मल बाग़, चीला, कुंजापुरी, एम्स (AIIMS), जॉली ग्रांट, योग नगरी ऋषिकेश, केदारनाथ, गौरीकुंड, सोनप्रयाग, गुप्तकाशी, बद्रीनाथ.
- These stay in Latin script as written: Rishikesh Homestays, Advaitam (Ganga & Hill View), WhatsApp, Airbnb, Booking.com, MakeMyTrip, FASTag, Rajmargyatra, UPI, ISBT, SUV, OTT, Royal Enfield, Himalayan (the bike), Zomato, Swiggy, Blinkit, Guest Favourite, White Album, The Beatles, and the cafe names (Little Buddha Cafe, Om Freedom Cafe, The 60's Cafe, Shambala Cafe, Devraj Coffee Corner, The Arches Cafe & Bakery, Ramana's Organic Cafe, Pure Soul Cafe & Organic Kitchen, Bistro Nirvana, Cheetal Grand). The one exception is Chotiwala, which is written चोटीवाला as on its own Hindi signboard.
- Common terms: homestay = होमस्टे; stay = ठहराव; enquiry = पूछताछ; shortlist = छोटी सूची; aarti = आरती; snan = स्नान; Amrit Snan = अमृत स्नान; tithi names use their Hindu calendar forms (मौनी अमावस्या, माघ पूर्णिमा, सोमवती अमावस्या…).
- Numbers use the digits 0–9 and stay exactly as in the English (₹670–675, ₹1,000, 3,583 मीटर, 14 अप्रैल 2026). Millions keep the English figure and add lakh in brackets: "9.1 मिलियन (91 लाख)".
- "Illustrative view of …" alt text becomes "… का चित्रण", which tells the reader it is an illustration and not a photo.
- Phone numbers, the email address, prices, URLs and the WhatsApp prefilled text never enter the catalogue, because the extractor skips href values and strings with no letters.

## Drift found in the back-translation pass and fixed

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

## Checked and kept as they are (not drift)

- "Things to do" became घूमने-करने को ("things to see and do"). This is the usual Hindi nav label, with the same meaning.
- On the Kedarnath trail, "pony" became घोड़ा ("horse"). Signboards and pilgrims on the trail say घोड़ा-खच्चर, and पालकी stays पालकी.
- "Kedarnath temple opens/closes for the season" became कपाट खुलते/बंद होते ("the doors open/close"). This is the standard Hindi idiom for the same event.
- "Before 6 am is the magic hour" became सबसे बढ़िया समय ("the best time"). A literal "magic hour" sounds odd in Hindi, and the meaning is the same.
- The puns and jokes on the 404 page and the drive page ("they will not wave back", "the lanes will win", "the lanes have opinions") are kept as jokes with the same sense.
- The mantras ॐ नमः शिवाय and हर हर गंगे are already Hindi and stay the same.

## Notes on the English for the owner (Hindi follows the English as it is)

- On the contact page, "Get better, stay matches." and "airport pickups drops. We covered you all" read like typos in the English. The Hindi uses the meaning the owner most likely intended.
- The Advaitam page says "a genuine, independently run homestay". The stays-page copy rules avoid the word "independent". The Hindi translates the English faithfully (स्वतंत्र रूप से चलाया जाने वाला). If the English changes, `stale.mjs` will flag the string.
- "Official" appears in the English of the Kumbh, Kedarnath and Haridwar sentences about government notices and portals. The Hindi keeps आधिकारिक, because there the word is about the government, not about us.

## Keeping it current

- Run `node scripts/i18n/extract.mjs` after English edits, then `node scripts/i18n/stale.mjs hi`. Changed English shows up as `missing`, and its old translation as `orphan`. Translate the new ids, delete the orphans, and back-translate the new strings before they go live.
- `stale.mjs` is a warning tool. It always exits with code 0.
