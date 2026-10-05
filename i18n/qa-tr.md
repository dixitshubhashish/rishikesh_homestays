# Turkish (tr) translation notes

- 15 pages, 1,540 strings (1,035 unique ids; ids shared across pages get one identical translation). Every id from en.json is present, with no extras. Valid JSON (2-space format).
- A script compared every string with the English: the same `<n>`/`<n/>` tags, `{placeholders}` and entities in the same order, and the same ₹ amounts, phone numbers, emails and URLs. 0 mismatches.
- Address: polite "siz" throughout. Turkish booking and travel sites (Booking.com TR, Airbnb TR) use it. Short UI strings follow Turkish web conventions: "Menü", "Ana Sayfa", "Menüyü aç", "Talep gönder", "İsteğe bağlı", "Giriş/Çıkış" for check-in/out.
- Homestay → "ev pansiyonu" (plural "ev pansiyonları"). The brand "Rishikesh Homestays" is unchanged. Workation → "iş + tatil". Scooty → "scooter". Auto-rickshaw → "otoriksa", e-rickshaw → "e-rikşa". Tempo traveller is kept and explained as "minibüs".
- River: "Ganj" in running text (the standard Turkish name, with suffixes Ganj'da, Ganj'ı). "Ganga Aarti" and "Ganga & Hill View" are kept as the ceremony name and the property name.
- Place names stay in Latin script as travellers write them (Rishikesh, Haridwar, Laxman/Lakshman Jhula as in the source, Triveni Ghat, Har Ki Pauri, Neelkanth Yolu, Swarg Ashram). Turkish case suffixes take an apostrophe and follow vowel harmony (Rishikesh'te, Haridwar'da, Triveni Ghat'ta, AIIMS'e). Generic words are translated (Tapınağı, Şelalesi, Aşramı, Ulusal Parkı). Proper ashram names such as Swarg Ashram and Sivananda Ashram are kept.
- Dates use the Turkish format ("14 Ocak 2027", Turkish weekday names). Month ranges without a day are lowercase per TDK ("ekim-mart"). Times are 24h ("10:00", "22:00–07:00"). Decimals use a comma ("2,5 km", "9,1 milyon") and thousands a dot ("3.583 m"). ₹ figures are copied exactly ("₹1,000").
- Hindu calendar names (tithi, snan names), the Devanagari mantras, cafe names, Advaitam names and brand names are unchanged. Makara Sankranti's "solar transition" is rendered correctly as "Güneş'in Oğlak burcuna geçişi", not as solstice.
- The jokes are rewritten for Turkish readers:
  - 404 page: the traveller "haritayı üçüncü kez ters çeviriyor"; "Chotiwala abimiz" swears it is "şuracıkta, beş dakika ileride"; "Durum: muhtemelen aydınlanmaya ermiş".
  - Elephants: "İsterseniz el sallayın. Onlar size el sallamayacak."
  - "Rishikesh'te park: sokakların kendi fikri var".
  - Haridwar lanes: "o sokaklarla inatlaşan hep kaybeder".
  - Spur road: "kendi lastiklerimiz o asfalta değmeden inanmayacağız".
  - Chai headline: "bir çay içimi sürede halledilir".
- Points to check: "3BHK" is kept in property names and is explained once as "3 yatak odalı daire". Lakhs → "yüz binlerce". OTT apps → "dijital platform uygulamaları".

## Copy-edit pass (native Turkish review, 2026-10-06)

**What was checked:** all 1,035 unique ids (1,540 strings on 15 pages) were read side by side with the English, looking at grammar, natural phrasing, meaning (doubtful lines back-translated), whether the jokes still land, consistent terms, and unchanged names, prices, phones, emails, URLs, tags and placeholders. Afterwards a script confirmed that every page and id matches en.json, with no gaps or extras, and that the tags, `{placeholders}`, entities, ₹ amounts, phone numbers and emails are the same and in the same order (0 mismatches). The file parses as valid JSON.

**Result:** the draft was already good. 30 unique ids were edited (31 strings, since one id appears on two pages). The reasons:

- **Grammar and spelling:** "terasler" became "teraslar". "Neden Rishikesh Homestays ile listelemelisiniz?" had no object, so it became "Tesisinizi neden Rishikesh Homestays'te listelemelisiniz?" The meta text was fixed the same way ("Tesisinizi bizde listeleyin"). The title "Rishikesh'ten Kedarnath Yatra" was missing a case ending and became "Rishikesh'ten Kedarnath Yatra'ya".
- **Unnatural or literal wording:**
  - "Hacı kasabasından" became "Hac kasabasından".
  - "Şehri koşturmadan Rishikesh'te yapılacaklar" became "Rishikesh'te acele etmeden yapılacaklar".
  - "6–8 Mart ile 3 günlük hafta sonu" became "6–8 Mart: 3 günlük hafta sonu".
  - "Gezginle eşleşen talepler" became "Size uygun misafir talepleri".
  - "Bir üsse de mi ihtiyacınız var?" became "Kalacak bir yer de mi lazım?"
  - "Tüm gruba bir arada olabileceği alanı verin" became "Bütün grup rahatça bir arada olsun".
  - "Dönüş yolunu erken tutun" became "Dönüşe erken çıkın".
  - "Rishikesh'e son bir saat" became "Rishikesh'e son bir saatlik yol".
  - The "alınma" (pickup) wording became "servis", "sizi istediğiniz yerden alır" or "Alış noktası".
  - "bacakları açmak" reads wrong in Turkish, so it became "bacakları esnetmek".
  - "akıntılar" for rapids became "azgın sular".
  - "Kumbh vesilesi" (table header) became "Kumbh günü".
- **Wrong meaning:** "small notes" had been translated as "bozuk para" (coins) and is now "küçük banknotlar". "Hot water geyser" had been translated as "şofben" (a gas heater) and is now "Termosifon" (an electric water heater). "one of the better" is now "en iyi seçeneklerden biri", which is the natural Turkish phrase. "Mobile:" is now "Cep telefonu:".
- **Voice and jokes:** the 404 line "Rota durumu: keyifle kaybolmuş" became "Rota durumu: mutlu mesut kayıp". The other jokes (the elephants, the parking lanes, the spur road, "beş dakika ileride", "aydınlanmaya ermiş") already landed and were left as they were.
- **Consistency:** the 404 card eyebrows read "Keşfet" and then "Keşfedin". The second one is now "Keşif". The "Travellers" select label is now "Seyahat grubu" rather than "Gezginler". The Airbnb rating in running text is now written "5,0", with a Turkish decimal comma. The "★5.0" badge stays as it is.

**Still uncertain:**
- "hacı" / "hac" for Hindu pilgrims is the standard Turkish word, but readers associate it with Islam. Possible alternatives are "yatrı" (too obscure) and "dindar ziyaretçi" (too long), so it stays.
- "German bakery" is kept as a loanword ("German bakery'ler"), because it names a specific Rishikesh cafe type rather than "Alman fırını". The owner may prefer the explanation "Alman usulü fırın-kafe".
- "Ev pansiyonu" for homestay is clear, though some Turkish sites just use "homestay". It is kept for readability.
- Hindu bathing-day names and the "3BHK" in property names are left unchanged as proper names.
