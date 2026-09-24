const SLIDE_INTERVAL_MS = 5000; // industry-standard hero slideshow pace (4-6s/slide)
const TEXT_FADE_MS = 400;
const MOBILE_QUERY = '(max-width: 680px)';
const PANEL_GRADIENTS = [
  ['#38a6a0', '#2869a0', '#0b2736', '#173e4b'],
  ['#28a18e', '#2b668f', '#092938', '#104344'],
  ['#5d4a8d', '#b26545', '#151d35', '#29233b'],
  ['#c17a43', '#8d463a', '#292034', '#633c2d'],
  ['#77a85f', '#357e96', '#102d43', '#214334'],
  ['#d06b38', '#914139', '#211a32', '#622d24'],
  ['#62a66f', '#377d99', '#102d3b', '#263e37']
];

function parseJSONList(el, attr) {
  if (!el) return [];
  try {
    return JSON.parse(el.dataset[attr] || '[]');
  } catch {
    return [];
  }
}

function fadeSwap(el, nextText) {
  if (!el || !nextText) return;
  el.classList.add('is-fading');
  setTimeout(() => {
    el.textContent = nextText;
    el.classList.remove('is-fading');
  }, TEXT_FADE_MS);
}

function pickBg(slide) {
  const wantsMobile = window.matchMedia(MOBILE_QUERY).matches;
  return (wantsMobile && slide.dataset.bgMobile) || slide.dataset.bg;
}

// Slides carry their image URL in data-bg/data-bg-mobile, not inline
// background-image, so the browser only fetches the ones we explicitly set —
// otherwise all seven full-size hero photos would download on every load
// even though the slideshow only ever shows one at a time.
function ensureLoaded(slide) {
  if (!slide) return;
  const url = pickBg(slide);
  if (!url) return;
  if (slide.dataset.loaded) return;
  slide.style.backgroundImage = `url('${url}')`;
  slide.dataset.loaded = 'true';
}

// Warms the browser's HTTP cache for an upcoming slide ahead of time, so the
// crossfade into it never shows a blank frame, without blocking anything on
// the current slide (it's a plain background fetch, not a page resource).
function preload(slide) {
  if (!slide || slide.dataset.loaded) return;
  const url = pickBg(slide);
  if (!url) return;
  const img = new Image();
  img.onload = () => ensureLoaded(slide);
  img.src = url;
}

export function setupHeroSlideshow() {
  const container = document.querySelector('.hero-slideshow');
  const hero = container?.closest('.hero');
  const slides = container ? Array.from(container.querySelectorAll('.hero-slide')) : [];
  if (!slides.length) return;

  // Load the currently-visible slide immediately, before any of the
  // rotation/reduced-motion logic below — a reduced-motion visitor skips
  // the rotation entirely and would otherwise see a blank hero.
  const activeSlide = slides.find((slide) => slide.classList.contains('is-active')) || slides[0];
  setHeroSlideState(hero, slides.indexOf(activeSlide));
  ensureLoaded(activeSlide);

  if (slides.length < 2) return;

  const caption = document.querySelector('.hero-caption');
  const headline = document.querySelector('.hero-headline');
  const copy = document.querySelector('.hero-copy');
  const captions = parseJSONList(caption, 'captions');
  const headlines = parseJSONList(headline, 'headlines');
  const copies = parseJSONList(copy, 'copy');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  let activeIndex = slides.indexOf(activeSlide);
  scheduleIdle(() => preload(slides[(activeIndex + 1) % slides.length]));

  if (prefersReducedMotion) return;

  function showSlide(nextIndex) {
    ensureLoaded(slides[nextIndex]);
    setHeroSlideState(hero, nextIndex);
    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === nextIndex);
    });
    fadeSwap(caption, captions[nextIndex]);
    fadeSwap(headline, headlines[nextIndex]);
    fadeSwap(copy, copies[nextIndex]);
    activeIndex = nextIndex;
    preload(slides[(activeIndex + 1) % slides.length]);
  }

  function start() {
    return setInterval(() => {
      showSlide((activeIndex + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
  }

  let timer = start();

  // Pause while the tab is hidden so slides don't jump on return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(timer);
    } else {
      clearInterval(timer);
      timer = start();
    }
  });
}

function setHeroSlideState(hero, index) {
  if (!hero) return;
  hero.className = hero.className.replace(/\bhero-slide-\d+\b/g, '').replace(/\s{2,}/g, ' ').trim();
  hero.classList.add(`hero-slide-${index + 1}`);
  hero.classList.toggle('hero-light-slide', index === 3);
  const panel = hero.querySelector('.hero-inner');
  const colors = PANEL_GRADIENTS[index];
  if (panel && colors) {
    panel.style.backgroundColor = colors[3];
    panel.style.setProperty('background-image', `radial-gradient(circle at 0% 0%, ${colors[0]} 0%, transparent 64%), radial-gradient(circle at 100% 18%, ${colors[1]} 0%, transparent 68%), radial-gradient(circle at 82% 100%, ${colors[2]} 0%, transparent 70%)`, 'important');
  }
}
