# Hebrew (he) QA: copy-edit pass

## What was checked
- All 15 pages, all 1,540 ids. There are 1,035 unique English strings. Each one was read side by side with its Hebrew, and any line in doubt was back-translated.
- Checked for grammar, calques and machine-sounding phrasing, wrong meaning, flat jokes, inconsistent terms, script, and anything that must stay unchanged (names, brands, ₹ prices, phones, emails, `<n>`/`<n/>` tags).
- Ids with identical English still get identical Hebrew on every page.
- Automated check after editing: every page and id is present, and tags, ₹ amounts, phone numbers and emails match the English in count and order (0 mismatches). The JSON parses as valid.

## What changed
- 113 unique strings were rewritten, which comes to 200 ids across the pages. Everything else was already natural and correct, and was left alone.
- **Calques made idiomatic:** "ומכאן אנחנו לוקחים את זה" became "ואת השאר תשאירו לנו". "רישיקש עובדת הכי טוב" became "רישיקש הכי טובה כשהימים שלכם לא דחוסים". "בנוי בשביל ההחלטות של מטיילים" became "כל מה שצריך כדי להחליט". "איך כל אחד מהם מרגיש" became "מה מאפיין כל אחד מהם". "בחרו בסיס לפי איך שאתם רוצים שהיום ירגיש" became "לפי סוג הימים שאתם רוצים". "לעוגנים נוספים ב-2027" was reworded. "הרף שלנו קצר וכן" became "כמה דרישות פשוטות וכנות".
- **Grammar:** "גשר ההולכי רגל" became "גשר הולכי הרגל" (3 places). A subject mismatch in the German-bakery line was fixed: "מוסד ותיק… וחלקן פועלות". A doubled "ו" in "וותרו… וחזרו" was fixed. "יושב על גדת" became "שוכן על גדת". "מדט" became "ישב במדיטציה". "פנים חדר השינה" and "הפנים המשותף" were rewritten as "חדר השינה מבפנים" and "החללים המשותפים". The doubled "פשוט… יום פשוט" was removed.
- **Meaning:** "Makara Sankranti" had been written as "מקרה" (Hebrew for "incident"). It is now "מקארה". Seniors was "מבוגרים", which reads as just "adults", and is now "מטיילים מבוגרים" / "גיל השלישי". "Railway Road" had become "דרך הרכבת" and is now "ריילווי רוד". "Last heard at the lost-and-found tent" now reads "נשמע לאחרונה ברמקול של אוהל האבדות". "Arrive" was "נוחתים" and is now "מגיעים". Triveni Ghat "riverfront" is now "הגאט המרכזי" / "רחבת הנהר" instead of the literal "חזית הנהר". The Bhagirathi is now one of the Ganga's "נהרות המקור" instead of "יובלי המקור". 11 feet now also shows metres (כ-3.4 מטר).
- **Voice and jokes:** Sharpened lines: the signpost "לא מצליח להסכים עם עצמו", rafters as "החבר'ה מהרפטינג", "Half of Delhi has the same idea" as "לחצי דלהי יש בדיוק אותו רעיון", the bike-rental "sorted over one chai" as "מסודר עוד לפני שתסיימו כוס צ'אי", the Royal Enfield line "פשוט תענוג ברגע שהכביש מתחיל לטפס", and New Year as "סילבסטר" for Israeli readers. These already worked and were kept: the elephants that won't wave back, "הסמטאות ינצחו", "לסמטאות יש דעות משלהן", "נאמין כשהצמיגים שלנו ייגעו בו", "רגע, טוב לי פה", and the Israeli-food wink.
- **Short UI:** Home is now "דף הבית" and Skip to content is now "דילוג לתוכן". "Plan my stay" is now "לתכנון השהייה", because "תכננו לי שהייה" read as an order given to the user. "Explore" is now "לטייל". "Open WhatsApp" is now "פתיחת וואטסאפ". The footer label is now "ניווט בתחתית העמוד". Listings are now "מודעות" instead of "רשומות". "Bike & taxi" in the nav is now plural, matching the page title.

## Still uncertain
- **Hindu terms:** tithi, Amrit Snan and festival names (טיתי, אמריט סנאן, מאוני אמאוואסיה, נאב סמווטסאר) are transliterated. Most Israeli readers won't know them, but the English doesn't explain them either.
- **Name spellings:** Hebrew spellings of less-known places (קוביאמרק, צ'אוראסי קוטיה, טריאמבקשוור, סצ'ה אקהילשוור) are phonetic best guesses. There is no settled Israeli spelling for them.
- **Latin names in RTL text:** brand and property names stay in Latin inside Hebrew sentences (Advaitam Ganga & Hill View, Cheetal Grand, cafe names). They display correctly only if the page sets `dir="rtl"` and the browser handles the mixed direction. Strings that start with a Latin name (e.g. "Advaitam Ganga & Hill View היא…") should be checked visually.
- **Arrow:** the 404 Kumbh link uses "←" for RTL. Any other arrows the HTML adds outside the strings will need flipping in the template.
- **Units:** "5+ days" offers are rendered as "5 לילות ומעלה", which is the Israeli booking convention. Confirm with the owner that nights and days mean the same here.
- **Rendering:** I did not see the rendered pages, so line breaks and overflow in narrow RTL buttons were not checked.
