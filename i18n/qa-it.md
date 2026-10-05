# Italian (it) translation notes

## Translation pass (summary)
- 15 pages, 1,540 ids (1,035 unique strings); all present, none empty.
- Voice: informal "tu" throughout (normal for Italian travel sites). Quirky lines were rewritten, not translated literally.
- Kept unchanged: property, cafe and temple names, brands, ₹ prices (incl. "₹1,000" as in the source), phones, emails, URLs, festival/tithi names, and the Hindi/Sanskrit lines.
- Place names: Rishikesh, Haridwar, Laxman/Lakshman Jhula (as in the source), Triveni Ghat. "Ganga" becomes "Gange" in running text but stays in fixed names (Ganga Aarti, Advaitam Ganga & Hill View). Valley of Flowers is "Valle dei Fiori (Valley of Flowers)".
- Formats: Italian dates, decimal comma (2,5 km, ★5,0), 24-hour times.

## Copy-edit review (native strict pass)
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

## Verification
- `JSON.parse` passes. Pages and ids are identical to en.json, in the same order, and none are empty.
- `<n>`, `<n/>`, `{..}` and entities match en.json in count and order in all 1,540 strings (0 mismatches).
- File formatting is unchanged (2-space indent). The diff touches only the 46 edited values.

## Still uncertain / for the owner
- Temple and site names are mostly left in English ("Neelkanth Mahadev Temple", "Kunjapuri Devi Temple"). An Italian guide might write "il tempio di Neelkanth Mahadev". I kept them as proper names for consistency with maps and booking sites.
- "aarti" / "Ganga Aarti" is treated as masculine ("il Ganga Aarti"). Usage in Italian varies (some sources write "la Ganga Aarti", for "la cerimonia"). It is consistent across the file.
- "caffè" is used for "cafe". "café" is also seen on Italian sites. I kept "caffè" as the more natural word.
- "₹1,000" keeps the English thousands comma, as in the source. Italian style would be "₹1.000", but price strings were not to be changed.
