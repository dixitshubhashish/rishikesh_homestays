# Korean (ko) translation notes

## Translator's notes (first pass)

- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json present, no extras. Script check: tags `<n>`/`<n/>`, `{placeholders}` and entities same count and order; ₹ amounts, phone numbers and email addresses unchanged. Valid JSON, 2-space formatting.
- Polite 해요체/합쇼체 mix as used on Korean travel sites ("~하세요", "~드립니다"); short UI labels are nouns (메뉴, 홈, 문의, 숙소 찾기).
- Place names in Hangul as Korean travellers write them: 리시케시, 하리드와르, 락슈만 줄라 (Laxman/Lakshman both), 람 줄라, 트리베니 가트, 타포반, 스와르그 아쉬람, 무니 키 레티, 닐칸트 (로드), 하르 키 파우리, 케다르나트, 바드리나트, 데라둔, 졸리 그랜트 공항. AIIMS kept in Latin.
- River: 갠지스강 in running text; Ganga Aarti = "갠지스 아르티"; Kumbh Mela = 쿰브 멜라; snan = 스난 (with 목욕일 where it reads better).
- Kept in Latin script: stay/property names (Advaitam Ganga & Hill View…), cafe/restaurant names on the places page (Little Buddha Cafe, Chotiwala…), brands (WhatsApp, Airbnb, Booking.com, MakeMyTrip, Royal Enfield, FASTag, Zomato, Swiggy, Blinkit, Rajmargyatra), Hindi mantras in Devanagari.
- Dates in Korean order ("2027년 1월 14일", "목요일"); "starting ₹700 onwards" = "₹700부터"; lakhs = 수십만 명; scooty = 스쿠터; tempo traveller = 템포 트래블러(승합차); 3BHK kept, explained as 침실 3개 where it is a feature.
- Jokes rewritten for Korean: 404 ("경로 상태: 기분 좋게 길 잃음", "현재 상태: 아마도 해탈", Kumbh twins "발리우드 영화처럼 생이별", "미아 보호소 텐트"), elephants "코끼리가 답례하진 않겠지만요", "골목에도 고집이 있습니다", "그 골목들을 이길 수는 없습니다", spur road "저희 차 타이어가 직접 닿아 보기 전까지는 믿지 않으려고요", chai headline "차이 한 잔 마시는 사이에 해결".
- Copyright line: "All Rights Reserved." translated as "모든 권리 보유."

## Still uncertain / for the owner

- "The 60's Cafe (The Beatles)" and other cafe names left in English; the descriptions name them in Korean context.
- Kumbh tithi names are transliterated (마가 크리슈나 아마바스야 …); Korean readers won't know them, but they are labels, not prose. Makara Sankranti explained as "태양이 염소자리로 들어가는 날".
- ₹ amounts keep English digit grouping (₹1,000), which is also the Korean convention.

## Copy edit (second pass, native Korean review)

**What was checked:** all 15 pages, every one of the 1,035 unique English/Korean pairs (1,540 strings incl. repeated header/footer) read side by side; doubtful lines back-translated. Checked grammar, naturalness, meaning, jokes, term consistency, script (no stray kana/hanzi; only brand/property/cafe names, units and codes left in Latin), and that names, ₹ amounts, phones, emails, URLs and `<n>` tags/placeholders are unchanged (automated check: same pages and ids, same tag/placeholder sequence and same numbers/emails in every string, valid JSON).

**Verdict on the first pass:** high quality: natural 해요체/합쇼체, jokes already localised well (404, elephants, spur road, lanes "고집"). Changes were polish, not rescue.

**Lines changed: 40 unique strings (68 including repeats of the shared header/footer across pages).**

- Jokes/voice (404): "이정표조차 … 의견이 갈리네요" → "갈팡질팡하네요" (one signpost can't disagree with itself); "현재 상태: 아마도 해탈" → "해탈한 것으로 추정됨" (keeps the deadpan police-report tone of "presumed"); "잠깐, 여기 좋은데요" → "잠깐만요, 여기 마음에 드는데요".
- Grammar: "인도에서 ❤️을 담아" (particle after emoji reads wrong) → "인도에서 ❤️ 담아 만들었습니다".
- Meaning: Haridwar aarti "louder, larger" had lost "louder" (웅장하며) → "더 떠들썩하고 규모도 크며" (about-rishikesh and the Kumbh page); "Car or taxi" was 자가용 (one's own car) → 승용차 on the Triveni Ghat page (자가용 kept where English says "private car"); "Parking on premises" 건물 내 주차 → 숙소 내 주차; "Leave before dawn" 새벽 전에 (odd) → 동트기 전에 (2).
- Unnatural phrasing: "숭배받는 시바 사원" → "참배객이 끊이지 않는 시바 사원" (2); "Context:" label "한마디:" → "소개:" (6 season/time cards); 404 card kickers 탐험/발견 → 체험/탐방; traveller filter "전체" → "유형 무관", "친구" → "친구끼리"; "추천 받을게요" → "추천해 주세요"; "가르왈 관문 여행 계획하기" → "가르왈 여행 계획하기"; "다른 예약 사이트" → "다른 사이트에도 등록되어 있어요"; kicker "여행자의 선택을 돕기 위해" → "여행자의 선택을 돕는 정보"; "리시케시에서 케다르나트 순례" (title/link read as "a pilgrimage held in Rishikesh") → "리시케시–케다르나트 순례" / "리시케시 출발 케다르나트 순례".
- Transliteration: Bajrang 바지랑 → 바즈랑 (2); Trayambakeshwar 트람바케슈와르 → 트라얌바케슈와르 (2).
- Consistency: "&" between Korean words → "·" as elsewhere on the site (식당·카페, 케다르나트·가르왈, 리시케시·하리드와르 소개, 탈리·남인도 음식, Royal Enfield·히말라얀급).

**Still uncertain:**
- "© … 모든 권리 보유." is correct but many Korean sites leave "All rights reserved." in English; either is fine.
- Property names are kept in English inside Korean sentences ("저희 Advaitam Ganga & Hill View homestay는"); readable, but the owner may prefer "Advaitam 홈스테이" in running text.
- Hindu calendar/tithi names remain transliterations (unfamiliar to Korean readers, but they are labels).
