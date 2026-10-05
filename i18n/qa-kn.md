# Kannada (kn) QA: copy-edit pass

## What was checked
- All 15 pages and 1,540 ids. Each of the 1,035 unique English strings was read side by side with its Kannada value.
- Each line was checked for grammar, natural phrasing, meaning (doubtful lines were back-translated), consistent terms, script, and whether the joke still works in the quirky lines: the 404 page, the parking and expressway asides, the bike-rental copy, and "half of Delhi has the same idea".
- Kept unchanged: property, cafe and brand names (Advaitam, Little Buddha Cafe, Chotiwala, Airbnb, Booking.com, MakeMyTrip, WhatsApp, FASTag, Zomato, Swiggy, Blinkit, Royal Enfield), ₹ amounts, phone numbers, the email address, and the `<0>…</0>` and `<0/>` tags. A script compared the tags against the English after the edits and found no mismatches. `kn.json` passes `JSON.parse`, and every page and id from `en.json` is still present.

## Overall verdict
The translation was already strong: idiomatic, natural Kannada with the guide voice intact. Most of the jokes already landed. Examples are "ಅವು ಮಾತ್ರ ತಿರುಗಿ ಕೈ ಬೀಸುವುದಿಲ್ಲ" (the elephants), "ನಮ್ಮ ಕಾರಿನ ಟೈರ್ ಅದರ ಮೇಲೆ ಉರುಳುವವರೆಗೆ ನಾವು ನಂಬುವುದಿಲ್ಲ", "ಕೊನೆಗೆ ಗೆಲ್ಲುವುದು ಓಣಿಗಳೇ", "ರಿವರ್ಸ್ ಗೇರ್ ನಾಟಕವಿಲ್ಲದೆ" and "ಛಲ ಬಿಡದ ಚಹಾ ಮಾರುವವರು". The edits below are fixes, not a rewrite.

## Changes: 33 unique strings (104 ids, because menu and footer strings repeat on every page)
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

## Still uncertain or worth a visual check
- The 404 split sentence now has a comma at the end of the middle segment. Check that it still looks right if that segment is styled differently, for example highlighted or on its own line.
- AIIMS is written as ಏಮ್ಸ್ throughout, with "(AIIMS)" added at the first mention on some pages. That is the common Kannada press spelling. ಏಐಐಎಂಎಸ್ is the alternative if the owner prefers it.
- The guide voice is mildly colloquial in places, for example "ಐಡಿಯಾ", "ಮೂಡ್", "ಜಾಮ್" and "ಟ್ರಿಪ್". That is intentional and matches how Bengaluru travel sites write, but it is less formal than textbook Kannada.
- "Made with ❤️ in India" stays as "ಭಾರತದಲ್ಲಿ ❤️ಯಿಂದ ತಯಾರಿಸಲಾಗಿದೆ", where the emoji stands in for the word "love". This is fine as is.
