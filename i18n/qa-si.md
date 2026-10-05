# Sinhala (si) QA

## What was checked
- All 1,035 unique strings, compared with `en.json`: UI labels, form fields, headings, alt texts, long guide paragraphs, the 404 jokes, and the sarcastic lines on the driving and bike pages.
- I checked terms for consistency: හෝම්ස්ටේ, නවාතැන, ඝාට්, ගංගාව/ගඟ, චෙක්-ඉන්, ත්‍රීවීල් (auto-rickshaw) and වර්කේෂන්. I also checked script use: brand, stay and cafe names stay in Latin, and place names are in Sinhala.
- `JSON.parse` passes, and `node scripts/i18n/stale.mjs si` reports 0 missing, 0 orphaned and 0 suspect.

## Changes (13 strings)
- **Wrong meaning (2):** "half-day" had been translated as පැය භාගයක, which means "half an hour". It now reads භාග දවසක (Neelkanth temple visit, "Make a half-day temple trip").
- **Wrong meaning (1):** "hosts who can sort your wheels" had been rendered as if hosts *have already* arranged a vehicle. It now says they *can* arrange one.
- **Quotes (6):** German-style „…“ quotes in the 404, about, places, kedarnath and Kumbh lines became the standard “…”.
- **Tone or naturalness (4):**
  - "Featured Homestays" changed from විශේෂාංග හෝම්ස්ටේ to තෝරාගත් හෝම්ස්ටේ.
  - "Go live" changed from සජීවී වෙන්න (which sounds like live-streaming) to අඩවියේ පළ වෙන්න.
  - "Goes via" changed from the awkward යන්නේ හරහා to යන්නේ මේ හරහා.
  - "Royal Enfield country" changed from රාජ්‍යය to ලෝකය.
  - The "very determined chai sellers" joke now reads කවදාවත් අත්හරින්නේ නැති චායි වෙළෙන්දෝ, which keeps the joke.

## Overall
The translation was already of high quality. It reads as natural, colloquial written Sinhala that fits the guide voice. The 404 jokes work in Sinhala, for example "presumed enlightened" → බොහෝ විට නිවන් දැකලා. Placeholders, ₹ amounts, phone numbers and the email address are all intact.

## Uncertain
- The style is conversational (කියලා, නෑ, ඕනේ) rather than formal. This fits the site's voice, but a formal Sinhala reader may expect ලිඛිත style in the long history paragraphs.
- The Kumbh numbers add ලක්ෂ conversions next to the millions, for example "මිලියන 9.1ක (ලක්ෂ 91ක)". These are correct, but the English doesn't have them.
- "Advaitam Ganga hill-view 3BHK" keeps the brand name and translates the descriptor. Other Advaitam strings keep "Ganga & Hill View" in English because it is the property name.
