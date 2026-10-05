# Japanese (ja) copy-edit QA

## What I checked
- I read every page in full, all 15 pages and all 1,035 unique ids, side by side with `en.json`. I looked for grammar errors, wording that reads like a translation, wrong meaning, jokes that fell flat, inconsistent terms, wrong script and anything translated that should have stayed as it was.
- Shared ids appear on more than one page. Each one has the same value everywhere: 0 inconsistencies before the edit and after it.
- A script compared every edited string with the English. Tags `<n>`/`<n/>`, `{placeholders}`, entities, ₹ amounts, phone numbers, emails and URLs all have the same count and order. The pages and ids exactly match `en.json`, and the file passes `JSON.parse`. The 2-space format and trailing newline are unchanged.
- Kept as they were (correct): property, cafe and brand names in Latin script, the Devanagari mantras and the "© … All Rights Reserved." line. Place names are in standard katakana (リシケシュ, ハリドワール, トリヴェーニー・ガート …). The river is ガンジス川 and the ceremony is ガンガー・アールティ throughout.

## Changes: 68 strings (out of 1,035 unique)
The translation was already good overall. The edits fall into five groups:

1. **Wrong meaning (5)**
   - `ba5930c61089`: "private home" had become 一軒家 (detached house), but the property is a flat. Now 貸切の住まい.
   - `829d6c7bc9bf`, `08bd001e4632`, `b8e36c8257ed`: "apartment" was アパート, which suggests a cheap rental block in Japanese. Now マンション, which fits a luxury 3LDK.
   - `3cd6bac88f1d`: "railway-road access" was 鉄道道路. It is the street called Railway Road, so now レイルウェイ・ロード.

2. **Unnatural or translated-sounding wording (about 40)**, for example:
   - 聖地 used twice in one sentence (`e40e6f8bdc53`).
   - 手頃なシンプルな宿 → 手頃でシンプルな宿.
   - 部屋の先まで計画しよう → 宿の外での過ごし方も計画しよう.
   - 「どこに泊まるのがいつ便利か」, rewritten.
   - 天文学的・太陰暦的に正しい瞬間に → 星と月の巡りが定める吉祥の時に.
   - 予備電源の必要性 → 予備電源が必要かどうか.
   - ここに泊まって、あそこへ行く → 泊まる場所と行く場所をセットで.
   - 融通の利く拠点 → 予定を変えやすい拠点.
   - 同じガートを共有する → 同じガートに居合わせる.

3. **Jokes and voice made sharper (10)**
   - 404 page:
     - Chotiwala's 「5分も行けばすぐだよ」.
     - 「2回も転覆しました」.
     - The Bollywood twin line, which said 生き別れ and 離ればなれ (the same idea twice). It now reads ボリウッド映画のお約束どおり…双子の片割れと生き別れに.
     - The button 「待って、ここにいたい」.
   - Driving guide:
     - 「車で乗り込もうなんて考えないこと。路地には絶対に勝てません。」
     - The chai sellers are now やる気満々のチャイ売り.
     - The Friday-evening line was split into two punchier sentences.
     - The last kilometre is now 「道中いちばん楽な区間になりますよ」.
   - Rental page: the scooter line is now 「元気に走ってくれます。カーブだけはお手柔らかに。」
   - Bike CTA: 今夜バイクを停める宿、決まっていますか？ The old version read as a parking question rather than a pitch for a stay.

4. **Short UI labels made more idiomatic (8)**:
   - Travellers: 旅行者 → 同行者.
   - Friends: 友人 → 友人同士.
   - Request shortlist → 宿の候補を依頼する.
   - Best for → おすすめ.
   - Receive bookings → 予約を受け付ける.
   - Nearby planning → あわせてチェック.
   - Layout → 間取りとベッド構成.
   - "Not the right fit?" → イメージと違いましたか？

5. **Smaller fixes**:
   - Added the missing も to the long-stay rate line on 2 ids.
   - "Advaitam ガンジス川…" now has a colon.
   - "our own homestay" was 当サイト自慢の (which adds praise). It is now 私たちが運営する.

## Still uncertain
- 3BHK → 3LDK (it stays 3BHK in the property's own name). This is right for Japanese readers, but the owner may want the Indian term kept.
- `6b21fb791ac0` "About" in the footer is 概要. If the link goes to the About Rishikesh page, リシケシュについて would be clearer. I could not see the link target from the JSON alone.
- Hindu calendar terms (マーガ月クリシュナ・アマーヴァーシャー etc.) are transliterated, which is accurate but obscure. The festival-name column next to them carries the meaning.
- アーダール for Aadhaar and ヨーグ・ナグリ・リシケシュ駅 have no settled Japanese spelling. These are reasonable transliterations.
