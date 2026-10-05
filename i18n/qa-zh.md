# Chinese, Simplified (zh) translation notes

## Translator pass
- 15 pages, 1,540 strings (1,035 unique ids); every id from en.json present. Tags (<0>, <0/>…), ₹ amounts, phone numbers, emails checked automatically: same count and order in every string.
- Left unchanged (identical to English): property name "Advaitam Ganga & Hill View Luxury 3BHK" (and "Advaitam Ganga and Hill View" in alt text), cafe/restaurant names (Little Buddha Cafe, Chotiwala…), brand names (Airbnb, Booking.com, MakeMyTrip, WhatsApp, Zomato, Swiggy, Blinkit, FASTag, Royal Enfield, Rishikesh Homestays), the Devanagari mantras, AIIMS.
- Place names in the usual mainland transliterations: 瑞诗凯诗 (Rishikesh), 哈里德瓦 (Haridwar), 恒河 (Ganga), 拉克什曼吊桥 (Laxman/Lakshman Jhula), 罗摩吊桥 (Ram Jhula), 特里维尼河坛 (Triveni Ghat), 哈基保里 (Har Ki Pauri), 塔波万 (Tapovan), 斯瓦格修行区 (Swarg Ashram), 穆尼基雷蒂 (Muni Ki Reti), 尼尔坎特 (Neelkanth), 凯达尔纳特 (Kedarnath), 巴德里纳特 (Badrinath), 德里/德拉敦/密拉特/鲁尔基 etc. Lesser-known temples/ashrams/bridges get a Chinese name plus the English in brackets on their card heading (e.g. 帕尔马特修行院（Parmarth Niketan）) so travellers can match local signs; small neighbourhoods (Nirmal Bagh, Kankhal, Bhupatwala, Shantikunj) kept in Latin script.
- Terms: homestay = 民宿; Ganga Aarti = 恒河夜祭; ghat = 河坛; ashram = 修行院; Kumbh Mela = 大壶节; Amrit Snan = 甘露圣浴; Char Dham = 四圣地; workation = 旅居办公; scooty = 踏板车; tempo traveller = 中巴（Tempo Traveller）; dharamshala = 朝圣客栈.
- "15% off" rendered the Chinese way as 85 折 (same discount).
- Kumbh table: tithi/occasion names given as Chinese gloss + romanised Sanskrit in brackets, since Chinese readers won't know the Hindu calendar names and locals will use the romanised ones.
- Jokes rewritten, not literal: 404 ("迷路迷得很开心", "疑似已经开悟", Bollywood twins), expressway elephants ("想挥手就挥吧，反正它们不会理你"), Haridwar spur ("等我们自己的轮胎真碾上去了，我们才信"), lanes ("你斗不过那些巷子", "小巷们自有主张"), "sorted over one chai" → "一杯奶茶的工夫就搞定".
- Pakoras and cutlets at Cheetal Grand given as 炸蔬菜团子 and 蔬菜炸饼, so a vegetarian reader does not read 肉 (meat) into "cutlet".

## Native copy-edit pass (zh-CN, strict)
- Checked: all 1,035 unique strings across the 15 pages (1,540 ids), each read against the English. I checked grammar, natural mainland phrasing, meaning (back-translated any doubtful line), tone and jokes, term consistency (民宿 / 河坛 / 修行院 / 恒河夜祭 / 大壶节 / 踏板车 / 中巴), script, and that names, brands, ₹ prices, phone numbers, emails, URLs and tags stayed untouched.
- Overall the translation was already good: fluent, idiomatic, and the jokes (404, elephants, "the lanes will win", the spur road) were adapted rather than translated word for word.
- Changed: 30 unique strings (44 ids, because of repeats such as the footer). Examples:
  - Unnatural or translationese: footer "用 ❤️ 在印度制作" → "在印度用 ❤️ 打造"; "还在找什么特定的东西？" → "还没找到你想找的内容？"; "当住宿和一份清晰的…行程挂上钩，旅行者通常下单更快" → "住宿要是能配上一份清晰的…行程，旅行者往往更快拿定主意"; "河流、急流，和一个更新的冒险身份" → "河流、激流，以及后来的冒险新身份"; "在瑞诗凯诗玩什么——不赶时间的玩法" → "在瑞诗凯诗慢慢玩，不必赶场"; "住在河边附近" → "住在河边" (the original said "near" twice).
  - Wrong or shifted meaning: "seasonal water flow" was rendered as 季节性水量可观 ("plenty of water"), now 水量随季节变化; "mela instructions" was rendered as 庙会 ("temple fair"), now 大壶节管理方; "Easy for short groups" now 人少时坐它最方便; "Show home view" was 查看家中景色, now 查看窗外景色; the extra Chinese word 次数 in "以及会用掉几次次数" removed; the redundant "市区禁止在市政范围内" removed.
  - "group" was translated as 团队 ("work team"), now 一行人; "这一组人" now 一行人.
  - Jokes: elephants "They will not wave back" sharpened to "想挥手尽管挥，它们可不会冲你挥回来"; Cheetal Grand "has fed families for decades" no longer reads as the awkward 喂饱着…一家家人.
  - Smaller fixes: FAQ "Yes, outstation cabs…" started with a bare 安排, now 可以。我们提供…; 在周中 → 适逢周中; 打算赶着大壶节出行 → 打算趁大壶节出行; "AIIMS 瑞诗凯诗" → "瑞诗凯诗 AIIMS".
- Re-verified after editing: valid JSON, same 15 pages and the same ids in the same order, and tags, entities, {placeholders}, ₹ amounts, phone numbers and emails match the English in every string (0 mismatches).
- Still uncertain:
  - Transliterations of lesser-known temples (设睹卢祇那神庙 for Shatrughna uses the classical Buddhist-sutra spelling, and 巴吉朗玻璃桥 for Bajrang Setu) are not standard in Chinese guidebooks. They are kept because the English name is shown in brackets on the card heading.
  - Janki Setu (贾娜基桥) and Janki Pul (贾娜基吊桥) are the same bridge, given slightly different names as in the English.
  - Hindu calendar terms in the Kumbh table (太阴日, Magha 月黑半月…) are explanatory glosses, not established Chinese terms.
  - "爽到飞起" (Royal Enfield) is deliberately colloquial internet slang, matching the playful English.
