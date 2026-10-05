# QA notes: Portuguese, Brazilian (pt)

## What was checked
- All 15 pages and 1,540 ids. I compared every string with the English and read them side by side as a native Brazilian copy editor. I grouped the 1,035 distinct English strings so that each was read once. Every repeated string (nav, footer, buttons, form labels) has exactly one Portuguese version, so terms stay consistent across pages.
- Grammar, natural phrasing, meaning (doubtful lines back-translated), joke and sarcasm landing (404 page, elephants, "lanes have opinions", "believe it when our tyres touch it", "sorted over one chai"), term consistency, and protected text.
- Protected text was re-checked by script after editing. Tags `<n>`, `</n>` and `<n/>`, `{…}`, HTML entities, ₹ amounts, +91 numbers, emails and URLs match the English in count and order: 0 mismatches. `JSON.parse` passes, and the pages and ids are identical to `en.json`.

## Overall verdict
The translation was already strong: idiomatic Brazilian "você" voice, correct Portuguese, and jokes that were rewritten rather than translated literally. Most lines needed no change.

## Changes: 53 distinct strings, 52 ids
1. **Clunky or calqued phrasing (most edits)**
   - "Onde ficam os agrupamentos?" became "Onde eles se concentram?"
   - "hospedagens iniciais anunciadas" became "hospedagens para começar".
   - "nossa meta para responder" became "meta de resposta aos pedidos".
   - "destino de peregrinação hindu doméstico" became "… para os próprios indianos".
   - "a cidade só cresceu a partir disso" became "a cidade aproveitou esse impulso".
   - "Um olhar mais de perto na casa" became "Conheça de perto a casa e o seu entorno".
   - "Planta e acomodações para dormir" became "Distribuição dos quartos e camas".
   - "Dê ao grupo todo espaço…" became "Espaço para o grupo todo ficar junto", because the old line was ambiguous.
   - "Planejamento por perto" became "Planeje o entorno".
   - "Planeje em torno dele" became "Monte sua viagem em torno do Kumbh".
   - "uma beira-rio central" became "um trecho central da beira-rio".
   - "fileira de cafés" became "rua cheia de cafés".
   - "extensões a Dehradun" became "esticadas até Dehradun".
2. **Meaning fixes**
   - "floresta de sal" read as "salt forest". It is now "florestas de árvores sal", the sal tree.
   - "A busca … está incluída?" (pickup) was ambiguous. It is now "A atividade inclui buscar você na região da hospedagem?"
   - "um lugar respeitoso" became "um bom lugar, sem atrapalhar ninguém".
   - "Easy for short groups … para ser buscado" was reworded so that it is clear the driver picks you up.
   - "um dos formadores do Ganges" became "um dos rios que formam o Ganges".
   - Kumbh table: "Dia de banho de abertura divulgado" became "Primeiro dia de banho divulgado", "Amrit Snan de encerramento divulgado" became "Último Amrit Snan divulgado", and "grande período" became "auge da peregrinação".
3. **Host form register**
   - "candidatura/candidatar" sounds like a job application. It became "inscrição/inscrever-se", for example "Inscreva sua propriedade", "Enviar inscrição" and "Inscreva-se".
   - "Contatos de hóspedes compatíveis" became "Hóspedes com o perfil certo".
   - "critério curto e honesto" became "poucos critérios, e todos honestos".
4. **Gendered (a) forms removed**
   - "Sozinho(a)" became "Viagem solo".
   - "Aberto(a) a sugestões" became "Aceito sugestões".
5. **Voice and jokes sharpened**
   - "Status: provavelmente iluminada" became "dada como iluminada", which parodies "dada como desaparecida".
   - "pode virar a resposta de ponta-cabeça" became "pode virar o jogo".
   - "sem drama de dar ré" became "sem drama de manobra".
   - "Uma casa privativa … se sentir em casa" repeated "casa". It became "Um lar só seu perto do Ganges, onde você se acomoda num instante!"
   - "alongue-se" became "estique as pernas".
6. **Small fixes**
   - "Vindo de (cidade)" became "Cidade de origem" (2 ids).
   - "De carro saindo de Delhi" became "Vindo de carro de Delhi".
   - "3BHK de luxo privativo" was reworded, with "três quartos" glossed once in the Delhi guide.
   - Comma placement in "Pegue as chaves (ou encontre seu motorista) e pé na estrada."

## Kept on purpose
- Brand and property names, "Menu", "Check-in"/"Check-out", Hindu calendar names, the Devanagari lines, and "3BHK" (the listing's own term).
- "o Ganges" in running text, with Ganga Aarti and Ganga Ghat kept in ritual and property names.
- "o yatra" in the masculine, used the same way throughout. "Scooter", "autorriquixá", "e-riquixá" and "van tempo traveller" were also kept.
- Plural imperatives addressed to a group on the Advaitam page ("Cozinhem juntos, usem a sala…"). This is natural in Brazilian Portuguese.

## Still uncertain
- "3BHK" stays opaque to most Brazilians. It is explained in context, but the owner may prefer "apartamento de 3 quartos" in headings. The page title and URL slug were left alone.
- "Gerador / inversor" for "power backup / inverter" is accurate, but many Brazilians would say "nobreak".
- Image alt texts that say "Editorial view" were rendered as "Ilustração". That is fine if the images really are illustrations.
