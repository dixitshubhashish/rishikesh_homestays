# Tamil (ta) translation notes

- 1,540 ids across 15 pages, all present; 1,035 unique English strings translated once and reused for repeated nav/footer strings.
- Kept in Latin script: brand and stay names (Rishikesh Homestays, Advaitam Ganga & Hill View, cafe names, Chotiwala, Cheetal Grand, Royal Enfield/Himalayan, Airbnb, Booking.com, MakeMyTrip, WhatsApp, Zomato, Swiggy, Blinkit, FASTag, Rajmargyatra, UPI), phone numbers, email, ₹ amounts.
- Place names in Tamil script as Tamil travel writing uses them: ரிஷிகேஷ், ஹரித்வார், லக்ஷ்மண் ஜூலா, ராம் ஜூலா, திரிவேணி காட், தபோவன், சுவர்க் ஆசிரமம், முனி கி ரேதி, நீலகண்ட், கேதார்நாத், எய்ம்ஸ் (AIIMS), கங்கை. "Ghat" as படித்துறை in running text, "காட்" inside proper names.
- Devanagari chants on 404 rendered as the Tamil forms ஓம் நமசிவாய / ஹர ஹர கங்கே (natural for Tamil readers).
- Jokes rewritten, not literal: 404 ("ஞானம் பெற்றுவிட்டதாக நம்பப்படுகிறது", "இருங்க, எனக்கு இங்கேயே பிடிச்சிருக்கு", old-cinema twins-separated-at-Kumbh), expressway elephants ("அவை திருப்பிக் கை அசைக்கப் போவதில்லை"), Haridwar spur ("எங்கள் வண்டியின் டயர் அதில் உருளும் நாளில்தான் நம்புவோம்"), parking ("சந்துகளுக்குச் சொந்தக் கருத்து உண்டு", "சந்துகளிடம் உங்கள் கார் தோற்றுவிடும்").
- Placeholder tags (<0>…</0>, <0/>) checked: same count and order as English in every string. Some Tamil word order puts the tag after a postposition-bearing noun (e.g. "<0>…வழிகாட்டியைப்</0> பாருங்கள்"), which is grammatical.
- Review candidates: 2021 Kumbh figures converted to lakh (91 லட்சம் / 70 லட்சம) for Indian readers; "Workation" kept as வொர்க்கேஷன் (common loanword).

---

# Copy-edit QA pass (native Tamil review)

## What was checked
- All 1,035 unique English strings (covering all 1,540 ids on 15 pages) were read side by side with the Tamil. Lines I was unsure of were back-translated.
- Checks covered grammar, natural phrasing, meaning, tone and jokes, consistent terms, script, and the items that must stay unchanged: names, ₹ amounts, phone numbers, email, `<0>…</0>` and `<0/>` tags.
- Automated checks after editing: `JSON.parse` passes. Pages and ids match `en.json` exactly (15 pages, 1,540 ids), with none empty. Tags are the same in every string, in count and order. Phone numbers, email and ₹ amounts match the English. There is no Devanagari outside the two 404 chants, which were already turned into Tamil script.

## Overall verdict
The translation was already strong. Sentences are natural and the guide voice comes through. The jokes work in Tamil: the 404 page, the elephants on the expressway, the Haridwar spur ("we'll believe it when our tyres touch it"), the lanes winning over your car, and "half of Delhi had the same idea". None needed rewriting.

## Changes: 50 unique strings (78 ids, since repeated menu and footer strings count once per page)
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

## Still uncertain or for the owner to decide
- விசாரணை is used for "enquiry" everywhere. It is standard on Tamil booking sites, but it can also suggest a police "inquiry". கோரிக்கை would be a softer alternative if the owner prefers it. I left it unchanged for consistency.
- The 2021 Kumbh figures are given in lakh (91 லட்சம் / 70 லட்சம) rather than millions. This is correct and more natural for Indian readers.
- Hindu calendar terms are in their Sanskrit-derived forms (மாக, பால்குன, சைத்ர), as the English has them. Tamil readers usually know these months as தை/மாசி/பங்குனி/சித்திரை. They were not swapped, because the tithi names refer to the North Indian calendar.
- Many short UI buttons use the polite imperative (-உங்கள்), and a few use the bare form (திற, அனுப்பு, காட்டு). Both are normal on Tamil websites, so they were left mixed.
