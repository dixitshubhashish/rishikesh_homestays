# QA notes: Spanish (es), copy-edit pass

## Checked
- All 15 pages and 1,540 ids (1,035 unique strings) read side by side with en.json. Lines that sounded doubtful were back-translated.
- Grammar and natural phrasing, meaning, tone on the quirky lines (404, the elephants that won't wave back, the tyres, the lanes, the chai), consistent terms, and register.
- Things that must not change: names, brands, prices and ₹ amounts, phones, emails, URLs and tags. After editing, a script checked that the `<n>`, `</n>` and `<n/>` tags, `{…}` placeholders, entities, ₹ amounts, +91 numbers and emails match the English in count and order for every string: 0 mismatches. Every page has the same ids as en.json, and the file parses with JSON.parse.

## Changed: 68 strings (68 unique ids)
Overall the translation was good. The edits fall into these groups:

1. **Spain-only "vosotros" removed (14 strings).** The translator used "vosotros" forms ("cuántos sois", "llegáis", "os importa", "¿Podéis…?", "¿Organizáis…?", "con vosotros", "Descansad", "Cocinad, usad…"). A large part of the Spanish-speaking world never uses these forms, so they don't fit neutral international Spanish. The site now uses "tú" for the reader and "ustedes" for the company or the group.
   - "cuántos sois" became "cuántas personas viajan" or "el tamaño de tu grupo".
   - "¿Podéis organizar…?" became "¿Pueden organizar…?".
   - "Cocinad juntos, usad…" became "Pueden cocinar juntos, usar…".
2. **Neutral vocabulary.**
   - aparcar/aparcamiento (Spain) became estacionar/estacionamiento everywhere (about 30 strings).
   - Frigorífico became Refrigerador.
   - "puentes festivos" (Spain-specific) became "fines de semana largos" (4 strings).
3. **Grammar and agreement.** On the 404 page, "Visto por última vez" became "Vista por última vez", because the subject is la página (it is already "presuntamente iluminada").
4. **Unnatural or awkward lines.**
   - "Solo/a" became "En solitario".
   - "objetivo de respuesta a consultas" became "nuestro objetivo para responderte".
   - "según lo autoricen las autoridades" became "siempre que haya permiso local".
   - "Planifica la puerta de Garhwal" became "Planifica tu entrada a Garhwal".
   - "Elige la base de tu alojamiento" became "Elige dónde alojarte".
   - "pide libre el 15 de enero" became "pide el día libre el…" (4 strings).
   - "Solicítalo" and "Publicación" became the step labels "Envía tu solicitud" and "Publica tu anuncio".
   - "un alojamiento en casa" became "¿Recibes huéspedes en tu casa…?".
   - "Alojamiento en casa (habitación en una casa familiar)" became "Habitación en casa de familia".
   - "¿Listo para reservar…?" became the gender-neutral "¿Todo listo para reservar…?".
   - "en auto, coche…" became "en autorickshaw, coche…", because "auto" means car in Latin America.
5. **Jokes that fell flat.**
   - "the lanes have opinions" was rendered as "las callejuelas tienen su carácter", which is flat. It is now "las callejuelas tienen opinión propia".
   - "minus the guesswork" was rendered as "sin adivinanzas". It is now "sin sorpresas".
   - "atento a los avisos" became "no pierdas de vista los avisos".
   - "Pregunta por el estacionamiento… usa un estacionamiento" repeated a word; the line was reworded.

## Kept on purpose
- Informal "tú" throughout. "Alojamiento" for homestay, and the brand "Rishikesh Homestays" unchanged.
- "el Ganges" in running text, with ritual names kept as they are (Ganga Aarti). "la Kumbh" is feminine.
- Spanish decimals for numbers that aren't prices (2,5 km, 5,0). ₹ amounts are byte-identical to the English (₹1,000).
- Times in 24-hour format.
- Jokes that already landed well: "presuntamente iluminada", "No te van a devolver el saludo", "nos lo creeremos cuando lo pisen nuestras propias ruedas", "las callejuelas siempre ganan", "resuelto en lo que dura un chai", "Medio Delhi ha tenido la misma idea que tú".

## Still uncertain
- "coche" and "móvil" are Spain-leaning but understood everywhere, so they were kept. A Latin America-first audience might prefer "auto" and "celular".
- "tortitas" (pancakes) is the Spain word. Mexico would say "hotcakes" and the Southern Cone "panqueques". It was kept because no single word works everywhere.
- "La ciudad, de un vistazo" and other short UI labels were kept as the translator wrote them. They are fine, but the owner may want them shorter for the nav.
- "Lakshman Jhula" and "Laxman Jhula" both appear, because the English source uses both. They were left as they are.
