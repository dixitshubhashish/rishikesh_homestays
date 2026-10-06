// Language picker: a small dropdown in the site header (before the theme
// toggle), and in the phone nav drawer, where narrow phones find it. Every language is shown in its
// own name. Choosing one saves it ('rh-lang' in localStorage, read by the
// rh-i18n head snippet on every page) and reloads with ?lang=<code>, so the
// choice follows the visitor to every page. The page itself stays one English
// page; assets/js/i18n-runtime.js translates it in the browser.

export const LANGUAGES = [
  ["en", "English"], ["hi", "हिन्दी"], ["bn", "বাংলা"], ["ta", "தமிழ்"],
  ["te", "తెలుగు"], ["kn", "ಕನ್ನಡ"], ["mr", "मराठी"], ["ne", "नेपाली"],
  ["si", "සිංහල"], ["zh", "中文"], ["es", "Español"], ["fr", "Français"],
  ["pt", "Português"], ["ru", "Русский"], ["de", "Deutsch"], ["it", "Italiano"],
  ["ja", "日本語"], ["ko", "한국어"], ["id", "Bahasa Indonesia"],
  ["ms", "Bahasa Melayu"], ["tr", "Türkçe"], ["vi", "Tiếng Việt"], ["he", "עברית"],
];

export function currentLang() {
  return (typeof window !== "undefined" && window.RH_LANG) || "en";
}

// The URL to load for a language: ?lang=<code> (English drops the parameter
// once the choice is saved, so English URLs stay clean).
export function langUrl(href, code, saved) {
  const u = new URL(href);
  if (code === "en" && saved) u.searchParams.delete("lang");
  else u.searchParams.set("lang", code);
  return u.pathname + u.search + u.hash;
}

export function chooseLang(code) {
  let saved = false;
  try { localStorage.setItem("rh-lang", code); saved = localStorage.getItem("rh-lang") === code; } catch { /* private mode */ }
  location.href = langUrl(location.href, code, saved);
}

let count = 0;
export function buildPicker(doc = document, lang = currentLang(), extraClass = "") {
  const id = `rh-lang-${++count}`;
  const wrap = doc.createElement("div");
  wrap.className = `rh-lang-picker${extraClass ? ` ${extraClass}` : ""}`;
  wrap.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    <label for="${id}">Language</label>
    <select id="${id}" translate="no"></select>`;
  const select = wrap.querySelector("select");
  for (const [code, name] of LANGUAGES) {
    const opt = doc.createElement("option");
    opt.value = code;
    opt.lang = code;
    opt.dir = code === "he" ? "rtl" : "ltr";
    opt.textContent = name;
    if (code === lang) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => chooseLang(select.value));
  if (extraClass.includes("rh-lang-picker-header")) {
    // Header: only a globe and a two-letter code show ("EN", "HI"); the native
    // select lies invisibly on top, so its list still shows every name in full.
    const code = doc.createElement("span");
    code.className = "rh-lang-code";
    code.setAttribute("aria-hidden", "true");
    code.textContent = lang.toUpperCase();
    wrap.appendChild(code);
  }
  return wrap;
}

export function setupLangPicker(doc = document) {
  const header = doc.querySelector(".site-header .nav-wrap");
  if (header && !header.querySelector(".rh-lang-picker")) {
    const picker = buildPicker(doc, currentLang(), "rh-lang-picker-header");
    const before = header.querySelector("[data-theme-toggle]") || header.querySelector("[data-nav-toggle]");
    header.insertBefore(picker, before);
  }
  const drawer = doc.querySelector("[data-nav] .nav-drawer-footer");
  if (drawer && !drawer.querySelector(".rh-lang-picker")) drawer.appendChild(buildPicker(doc));
}
