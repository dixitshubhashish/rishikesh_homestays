# German (de) translation notes

## Translator's notes (first pass)

- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json present, no extras; tags/placeholders checked (same count and order); ₹ amounts, phones, emails unchanged. Valid JSON.
- Informal "du" throughout (standard for German travel sites), including the host page.
- River is "der Ganges" in running text; "Ganga Aarti" kept as the ceremony name; "Ganges-Ghat", "Gangesblick".
- "die Kumbh Mela" (feminine, as in German media); dates as "14. Januar 2027", weekdays in German; times 24h ("10:00 Uhr", "22:00–7:00 Uhr").
- Place names kept in Latin script, the way German travellers write them (Rishikesh, Haridwar, Laxman Jhula, Triveni Ghat, Har Ki Pauri…); temples written in the "Neelkanth-Mahadev-Tempel" style.
- Homestay kept as "Homestay" (common loanword); 3BHK explained as "mit 3 Schlafzimmern" except in the property name.
- Scooty = "Roller"; "starting ₹700 onwards" = "ab ₹700"; lakhs = "Hunderttausende".
- Jokes rewritten for German: 404 ("Status: vermutlich erleuchtet", traveller "dreht die Karte zum dritten Mal um"), elephants "Wink ruhig. Zurückwinken werden sie nicht.", "Die Gassen haben ihren eigenen Kopf", chai headline "geregelt, bevor dein Chai kalt ist", small aside on German Bakeries.
- Hindi mantras (ॐ नमः शिवाय, हर हर गंगे) left in Devanagari, as in English.

## Copy-edit pass (native German review, 2026-10-06)

**What was checked:** all 1,540 strings on all 15 pages, read side by side with the English: grammar, natural phrasing, meaning (back-translated where in doubt), tone and jokes on the 404 page, the driving guide, the rental page and the asides, consistent terms, du/ihr consistency, and the items that must not change. After editing, a script compared every string with the English again: same tags, `<n>` markers, `{placeholders}` and entities in the same order, and the same ₹ amounts, phone numbers and email addresses. 0 mismatches; every id is present. The file is valid JSON, written with the same 2-space formatting.

**Overall:** the first pass was good: correct grammar, mostly idiomatic, and the jokes already worked in German. **70 ids changed (70 strings; ids shared across pages were fixed everywhere they appear).**

### Wrong meaning (fixed)
- Makara Sankranti, "solar transition": was "Sonnenwende" (solstice), which is factually wrong. Now "Eintritt der Sonne in den Steinbock".
- Driving guide, "the cafes are half the fun": was "die halbe Miete" (which means "half the battle"). Now "die Cafés machen den halben Spaß aus".
- Kedarnath, "nights are near freezing": "fast frostig" was vague. Now "fallen die Temperaturen nachts fast auf den Gefrierpunkt".

### Grammar and consistency
- "beim Kumbh Mela" → "bei der Kumbh Mela" (404 page; the rest of the file uses the feminine).
- "Lord Vishnu" → "dem Gott Vishnu" ("Lord" is not used in German).
- "Hindu-Kalender" → "hinduistischer Kalender" (2×).
- "Rikscha" for "auto" → "Autorikscha", the term used everywhere else (2×).
- Advaitam "Why groups choose this home" switched from "du" to "ihr" in mid-paragraph. It now uses "ihr" throughout, since it addresses the group.
- "Privates Luxus-3BHK" → "Privates Luxus-Apartment (3BHK)".

### Unnatural or translated-sounding phrasing (examples)
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

### Tone and jokes sharpened
- Haridwar lanes: "die Gassen gewinnen" → "gegen diese Gassen hast du keine Chance".
- "ein einziger böser Stau kann die Antwort umdrehen" → "… kann alles auf den Kopf stellen".
- Rental CTA "Somewhere to park the bike tonight?" → "Wo parkst du heute Nacht das Motorrad?" (was the flat "Noch einen Platz fürs Motorrad heute Nacht?").
- Host page: "Lass uns deine Zimmer füllen." → "Wir füllen deine Zimmer."; "das Verhalten der Reisenden" → "wie Reisende ticken".
- German Bakery aside: "Nein, Laugenbrezeln gibt’s trotzdem nicht."

## Still uncertain / for the owner
- **German Bakery aside:** "(Ja, „German“. Nein, Laugenbrezeln gibt’s trotzdem nicht.)" is a joke the translator added; the English doesn't have it. It fits the site's voice and German readers will get it, but remove it if translations should add nothing.
- **"du" on the host page:** some German business pages would use "Sie". "du" is kept for one consistent voice.
- **₹ grouping:** amounts keep the English digit grouping (₹1,000) as required. A German reader might read it as 1.0. The amounts are unambiguous in context.
- **"Bike":** translated as "Motorrad" (in Indian usage "bike" means motorbike). The nav label "Motorrad & Taxi" is slightly longer than the English.
- **Kumbh dates and tithi names** are copied from the English and are not checked against an official source; that is a content question, not a translation one.
