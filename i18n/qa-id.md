# QA notes: Indonesian (id)

## Translation (from the translator)

- Coverage: 15 pages, 1,540 ids, all present; JSON parses; every `<n>`/`<n/>` tag, {placeholder} and entity matches en.json in count and order; ₹ amounts, phone numbers, emails and URLs unchanged.
- 148 values are deliberately identical to English: property, cafe and brand names, place names, Hindu calendar names, "Menu", "Email", "Check-in/Check-out", "Workation", and dates like "7 April 2027".
- Terms: homestay (kept), "penginapan" for stay/stays, "skuter matik" for scooty, "mobil lepas kunci" for self-drive car, "SIM" for driving licence, "Sungai Gangga" for the river (kept as "Ganga" inside names such as Ganga Aarti), "Kuil X" for temples, "Air Terjun X" for waterfalls.

## Copy edit (native-speaker review, 2026-10-06)

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

## Still uncertain

- "Pertanyaan" is used for "enquiry" throughout ("Kirim pertanyaan"). It is correct and consistent, but some Indonesian travel sites would say "permintaan" or "Kirim permintaan". I left it as it is for consistency.
- "bajaj (auto-rickshaw)" is explained once, and "auto-rickshaw" is used everywhere else. That is fine for Indonesian readers, but the owner may prefer one form throughout.
- ₹ amounts keep the English thousands comma (₹1,000) as the brief asks. Indonesian readers would normally write 1.000, so that line may look slightly foreign to them.
- "Workation", "staycation", "cafe hopping", "food court" and "rest area" are kept in English. They are common in Indonesian web copy.
