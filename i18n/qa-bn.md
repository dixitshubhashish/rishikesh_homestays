# Bengali (bn) QA review

## What was checked
- I read all 15 pages side by side with en.json. That covers all 1,540 strings, or 1,035 unique ids. Shared ids such as the nav and footer were checked once. Every repeated id already had the same Bengali on every page.
- Grammar and naturalness. The text is standard colloquial Bangla (চলিত ভাষা) using আপনি. I back-translated any line I doubted.
- Tone. The jokes on the 404 page, the highway and parking quips, the "lanes" jokes and the cheeky disclaimers were each checked to see if they still land in Bangla.
- Things that must not change: tags, placeholders and entities (same count and order as en.json, checked with a script, 0 mismatches), ₹ amounts, phone numbers, the email address, brand and stay names, cafe names, and model codes (3BHK, 150cc, Classic 350, NH-334).
- Script. No Devanagari characters were found. The only Latin text left is brand, stay and cafe names and product terms (WhatsApp, FASTag, Wi-Fi, SUV, ISBT, OTT, UPI).
- The file is valid JSON with 15 pages and 1,540 strings, none missing and none empty.

## Changes: 89 ids, 135 strings across pages
- **Jokes rewritten so they work in Bangla** (they were too literal before):
  - "the lanes have opinions" was গলিগুলোর নিজস্ব মতামত আছে. It is now এখানে গলির মর্জিই শেষ কথা.
  - "the lanes will win" is now গলির সঙ্গে লড়াইয়ে আপনি হারবেনই.
  - "Half of Delhi has the same idea" is now অর্ধেক দিল্লির মাথায় তখন ঠিক আপনার বুদ্ধিটাই খেলছে.
  - "minus the guesswork" is now আন্দাজে ঢিল ছোড়া ছাড়াই.
  - "sorted over one chai" is now এক কাপ চা শেষ হওয়ার আগেই সব ব্যবস্থা.
  - The 404 Kumbh "separated twin" line now reads as the Bollywood cliché: কুম্ভমেলার ভিড়ে যমজ ভাইয়ের থেকে আলাদা হয়ে গেছে.
  - "Chotiwala is sure" is now হলফ করে বলছেন.
- **Awkward or word-for-word phrasing fixed:**
  - হোমে ফিরছি is now হোম পেজে ফিরে যাচ্ছি.
  - …হোমস্টে খুঁজুন ঋষিকেশে had broken word order. It now reads ঋষিকেশের … হোমস্টে খুঁজে নিন.
  - বজরং সেতু কাচের সেতু is now বজরং সেতু (কাচের সেতু).
  - সাইকেল সফরে একটা থামা যোগ করুন is now সাইকেল সফরে এখানে একবার থামুন.
  - নমনীয় একটা থাকার ঘাঁটি is now পরিকল্পনা বদলালেও চলে এমন ঘাঁটি.
  - Repeated words were removed in two lines: রাখুন…রাখুন and চিরাচরিত…চিরাচরিত.
  - The Kedarnath trek time line said সাধারণ…সাধারণত and had an unclear subject. Both are fixed.
  - The 2021 Kumbh sentence used a passive construction that read badly. It has been rewritten.
- **Meaning fixes:**
  - "Active" (Tapovan) had become সারাক্ষণ হইচই, which sounds negative. It is now প্রাণবন্ত.
  - "Riverine habitat" had become বাসস্থান. It is now নদীতীরের বনভূমি.
  - "Shared space" had become সাধারণ, which reads as "ordinary". It is now সবার ব্যবহারের.
  - "Faith and movement" is now বিশ্বাস আর জনস্রোত.
  - "Holi creates a natural long weekend" had used আপনিই, which reads as "you yourself". It is now আপনা থেকেই.
  - "Is pickup included" is now explicit.
- **Consistent terms:**
  - "Wellness" is now ওয়েলনেস everywhere. It had been সুস্থতা in some places.
  - "River activities" is now নদীর অ্যাডভেঞ্চার.
  - Two English loanwords were replaced with Bangla: "সাজেস্ট করব" is now বেছে দেব, and "কান্ট্রি কোড" is now দেশের কোড.
- **Short UI text** was made more idiomatic: বাছাই তালিকা চাই, লিস্টিং চালু, সঙ্গে পোষ্য আছে?, বন্ধুবান্ধব, থাকার জায়গা (for the "Stay" heading).
- **Digits:**
  - Changed to Bengali digits: © ২০২৬, ★৫.০, and the placeholder যেমন: ৩.
  - The <0>30</0> countdown on the 404 page stays in English digits because the script updates it.
  - ₹ prices stay in English digits, as before.
- **Stay name:** the bike page link label "Advaitam Ganga & Hill View 3BHK" is back in Latin script so the property name stays unchanged.

## Still uncertain
- "Plan my stay" (থাকার পরিকল্পনা) and "List your homestay" (আপনার হোমস্টে যোগ করুন) are clear but a little long for a nav bar. A native UX reviewer could shorten them.
- The ₹ figure followed by a Bengali comma in cb9237e69a54 and 39197f0524d9 is correct as written. The checker's earlier flag on these was a false positive.
- The Hindi chants are written in Bangla script (ওঁ নমঃ শিবায় / হর হর গঙ্গে). This is intentional.
