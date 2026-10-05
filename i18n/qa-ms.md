# Malay (ms, Malaysian) translation notes

## First pass
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

## For the owner
- ₹ amounts keep the English digit grouping (₹1,000), which is also how Malaysians write numbers; decimals use a point (2.5 km), also standard in Malaysia.
- Hindu festival/tithi names (Mauni Amavasya, Vasant Panchami…) left untranslated, as they are proper names; Kumbh dates copied from the English, not checked against an official source.
- "Kumbh 2027" nav label and "Menu" are identical to English by design.

## Copy-edit pass (native Malaysian Malay review)

### What was checked
- Every unique EN/MS pair on all 15 pages (404, index, thanks, contact, homestays, about-rishikesh, places-to-visit, things-to-do, triveni-ghat, kedarnath-yatra, haridwar-kumbh-2027, list-your-homestay, driving guide, bike & taxi rental, Advaitam property page), read side by side for grammar, natural phrasing, meaning (back-translated where unsure), joke delivery, term consistency, and anything that must stay unchanged.
- Re-ran a script check after editing: same pages and ids in the same order as en.json, 1,540 strings, 0 mismatches in `<n>` tags, `{placeholders}`, entities, ₹ amounts, phone numbers and email addresses. Valid JSON.

### Changes: 34 unique strings (48 lines in the file, as some strings repeat across pages)
- Wrong or loaded religious terms: "berhala" (idol, pejorative in Malaysian usage) -> "arca" / "arca dewa" (Bharat Mandir, Kedarnath); "paderi" (Christian clergy) -> "pendeta" for the Har Ki Pauri priest families (2 pages); Vishnu "muncul ... kepada seorang pertapa selepas tempoh bertapa" -> "menampakkan diri ... kepada seorang resi selepas lama bertapa"; "orang awam" for householders -> "golongan berumah tangga".
- Meaning fixes: "catatan hari bekerja" (= working-day note) -> "catatan praktikal tentang hari dalam minggu" (weekday note in the Kumbh table); "banjir kilat" (flash flood) -> "jalan dinaiki air" (waterlogging); "bertukar tangan" (calque) -> "bertukar pemilik"; "Kami memanjangkan pertanyaan" -> "Kami menyalurkan pertanyaan"; "Pemindahan ke Haridwar" (sounds like relocation) -> "Perjalanan ke Haridwar"; "kuih-muih bakar" -> "pelbagai hasil bakeri".
- Unnatural/machine phrasing smoothed: "kawasan mana sesuai untuk menginap bila" -> "kawasan terbaik untuk menginap mengikut tujuan perjalanan anda"; "yang hanya sebentar memandu dari situ" -> "yang tidak jauh dari situ dengan kereta"; "Sediakan satu aktiviti..." -> "Peruntukkan masa untuk..."; "Rancang matahari terbit di Kunjapuri" -> "Rancang lawatan matahari terbit ke Kunjapuri"; "rafting sungai di Sungai Ganga" (repetition); "Menginap berhampiran yoga" -> "berhampiran pusat yoga"; "Memasak bersama, gunakan..." (mixed forms) -> "Masak bersama-sama, jadikan..."; "pagi berkopi" -> "pagi dengan kopi"; "asas rujukan" -> "atas dasar rujukan"; "Mula disiarkan" -> "Mula disenaraikan"; "Jangan lepaskan" (incomplete) -> "Wajib dikunjungi"; nav card "Menginap" -> "Penginapan" to match its sibling labels (Teroka, Temui).
- Jokes sharpened: 404 "sesat dengan gembira" -> "sesat, tapi bahagia"; "Kali terakhir didengar" -> "Kali terakhir dikesan" (reads like a missing-person notice); Kumbh "hotel mewah yang kereta anda tak dapat keluar" (broken) -> "bilik ringkas yang membolehkan anda terus berjalan kaki ke ghat lebih baik daripada hotel mewah yang kereta anda pun tak boleh keluar"; driving guide "tanpa drama mengundur" -> "tanpa drama undur-mengundur".
- Left as the translator had them (already natural): elephants "Mereka tak akan membalas", "lorong-lorongnya ada kehendak sendiri", "anda takkan menang melawan lorong-lorong itu", "selesai sebelum chai anda sejuk", "kami hanya akan percaya apabila tayar kereta kami sendiri menyentuhnya", "kamera laju akan uruskan selebihnya".

### Still uncertain
- "Homestay" vs "inap desa": kept the loanword, which is what Malaysian booking sites use; "inap desa" would sound like an official programme.
- "Neelkanth Road" and "Ganges Ghat" are left in English as place/label names; a local might write "Jalan Neelkanth", but the English form matches signage and maps.
- The rental page's "Advaitam Ganga hill-view 3BHK" link text is rendered with the property's full name ("Advaitam Ganga & Hill View 3BHK"). Same property, so this is harmless, but it is not word for word.
- "Kawan-kawan" vs "rakan-rakan": both are natural. Kept "kawan-kawan" for the friendly tone.
