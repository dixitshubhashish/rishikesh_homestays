# Nepali (ne) QA notes

## Translation notes (from the first pass)

- 15 pages, 1,540 strings. Every id from en.json is present. Tags and placeholders (`<0>`, `<0/>`, `{..}`, entities) match the English in number and order.
- Digits: Western digits (0-9) everywhere, including ₹ prices, phone numbers, dates and counts.
- Script: place names are in Devanagari, written the way Nepali readers write them (ऋषिकेश, हरिद्वार, लक्ष्मण झूला, त्रिवेणी घाट, स्वर्गाश्रम, मुनि की रेती, नीलकण्ठ, हर की पौडी). Brand, property and cafe names stay in Latin script (Rishikesh Homestays, Advaitam Ganga & Hill View, Little Buddha Cafe, Chotiwala, Beatles Ashram, Booking.com, WhatsApp, Airbnb, FASTag, Rajmargyatra, Zomato).
- Register: the polite "तपाईं" form throughout, with "-नुहोस्" imperatives in the UI.

## Copy-edit pass (strict native review)

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

### Main kinds of fixes, with examples

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

## Still uncertain or worth a native glance

- "वर्केसन" is a loanword that urban Nepali readers know. A gloss such as "काम गर्दै घुमाइ" would be clearer, but it is too long for the filter chips.
- "Stay" as a footer column heading is rendered as "बसाइ". This is fine, but some sites would use "बास".
- Hindu calendar terms follow Nepali usage (औँसी, भाइटीका for Bhai Dooj). Readers from Indian Nepali-speaking areas such as Darjeeling and Sikkim might expect "भाइ दूज". Both are understood.
- "Tera Manzil" is written "तेरह मञ्जिल", following the Hindi name that the English explains. A Nepali reader would say "तेह्र तले".
