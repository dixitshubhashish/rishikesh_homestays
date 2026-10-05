# Marathi (mr) QA notes: native copy-edit pass

## What was checked
- I read all 1,035 unique English strings next to their Marathi, page by page, across all 15 pages. Edits were made once per unique English string and applied to every id that has the same English, so the shared menu and footer stay identical across pages.
- Each string was checked for grammar and agreement, natural phrasing versus word-for-word phrasing, meaning (doubtful lines were back-translated), tone in the quirky lines (404 page, driving guide, rental page), consistent terms, script and nukta use, and protected items.
- A script then checked the result:
  - `mr.json` parses with `JSON.parse`.
  - It has the same 15 pages and 1,540 ids as `en.json`, with no empty values.
  - The `<0>…</0>` / `<0/>` tags match the English in count and order.
  - Every ₹ amount, +91 phone number, email address and URL is unchanged. The result was 0 problems.

## Changes: 33 unique strings (47 ids)
- **Wrong meaning:**
  - 404: "Chotiwala भाऊजी" became "Chotiwala भाऊंना". In Marathi, भाऊजी means brother-in-law, not "bhai ji".
  - Rafting context: "the most famous hub" became "one of the most famous hubs" (सर्वात प्रसिद्ध केंद्रांपैकी एक), as in the English.
  - Advaitam page: "Not the right fit?" was "हे तुम्हाला जमत नाही?" and is now "हे घर तुमच्यासाठी योग्य नाही?".
- **Grammar and agreement:**
  - "हलकं उबदार कपडे" became "हलके उबदार कपडे".
  - "निवांत सकाळी" was used as a plural noun. It is now "निवांत सकाळ" on the 404 page, the Advaitam "Slow mornings" heading and the yoga context lines.
  - "योगाच्या सकाळी" became "सकाळचा योग".
  - "एक मोठं ट्रॅफिक जॅम" became "एका मोठ्या ट्रॅफिक जॅममुळे".
  - The Triveni Ghat intro had an unfinished clause. It now reads "…ती एक अविस्मरणीय संध्याकाळ ठरते".
  - "(The Arches) …कायम असतं" now has a subject: "याचं नाव कायम असतं".
- **Unnatural or literal phrasing:**
  - "प्रवाशांच्या निर्णयासाठी बनवलेले" became "प्रवाशांना निर्णय घेणं सोपं जावं म्हणून".
  - "पुलाला भेट आखा" became "पूल पाहण्याचं नियोजन करा".
  - "तपोवनमधल्या सकाळीसोबत…जोडा" became "तपोवनमधली सकाळ आणि … एकत्र आखा".
  - "कुंभाचं दिसणारं हृदय…श्रद्धा आणि गती" became "डोळ्यांना दिसणारा कुंभ…श्रद्धा आणि लगबग".
  - "गर्दी नियंत्रित पद्धतीने सोडली जाईल" became "गर्दीच्या हालचालींवर नियंत्रण असेल".
  - "प्रत्यक्ष जमिनीवरची टीम" became "प्रत्यक्ष इथे असलेली टीम".
  - The "not a distant call center" line now has a full sentence.
  - The host step now says who confirms the booking.
  - The 150cc bikes line was rewritten.
  - "Rentals" became "वाहने भाड्याने".
  - "कोणता भाग तुम्हाला जमेल" became "…सोयीचा आहे".
  - "back-and-forth of a large platform" is now "संदेशांच्या उलटसुलट फेऱ्या".
  - The bedroom alt text was reordered.
- **Jokes and voice, sharpened:**
  - 404: "संभाव्य बातमी" became "दिसल्याची खबर". The line "शेवटचा आवाज…ऐकू आला" became "शेवटची हाक…तंबूतून ऐकू आली".
  - Expressway elephants: "हात हलवा" became the idiomatic "हात करा… ते काही उलट हात करणार नाहीत".
  - "the lanes have opinions" was "गल्ल्यांची स्वतःची मतं आहेत", a literal rendering. It is now "गल्ल्यांचा तोराच वेगळा".
  - "the most Rishikesh way" is now "अस्सल ऋषिकेशी पद्धत".
  - "minus the guesswork" is now "अंदाजपंचे न करता".
- **Script:**
  - "वसिष्ठ गुफा" became "वसिष्ठ गुहा", which is the Marathi word.
  - "तेरा मंज़िल" became "तेरा मंजिल". Marathi doesn't use the nukta. The alt text was fixed the same way.

## Left as is, on purpose
- The rest of the file was already natural and accurate, and it keeps the guide voice. Examples: "बहुधा मोक्षप्राप्ती झाली असावी", "त्या गल्ल्यांपुढे तुमची हार ठरलेली आहे", "एका कप चहात सगळं ठरतं" and "आमच्या गाडीची चाकं त्यावर टेकतील तेव्हाच आम्ही विश्वास ठेवू".
- Headings and nav use the -ए plural (ठिकाणे, काय करावे), while body text uses the spoken -ं form (ठिकाणं, मंदिरं). Marathi websites commonly do this, so it was kept.

## Still uncertain
- **Plural style:** a mix of -ए and -ं plurals appears in body text, such as मंदिरे in short UI lists and मंदिरं in paragraphs. The owner may want one style site-wide.
- **Brand name:** "Advaitam Ganga & Hill View homestay" is kept in Latin script inside a Marathi sentence, where the English has a lowercase "homestay". A reader could also expect "होमस्टे" there.
- **Kumbh figures:** the 2021 numbers are given in lakh (91 लाख / 70 लाख), as in the first pass.
