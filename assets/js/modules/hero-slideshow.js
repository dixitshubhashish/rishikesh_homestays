const SLIDE_INTERVAL_MS = 5000; // industry-standard hero slideshow pace (4-6s/slide)
const TEXT_FADE_MS = 400;

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

export function setupHeroSlideshow() {
  const container = document.querySelector('.hero-slideshow');
  const slides = container ? Array.from(container.querySelectorAll('.hero-slide')) : [];
  if (slides.length < 2) return;

  const caption = document.querySelector('.hero-caption');
  const headline = document.querySelector('.hero-headline');
  const copy = document.querySelector('.hero-copy');
  const captions = parseJSONList(caption, 'captions');
  const headlines = parseJSONList(headline, 'headlines');
  const copies = parseJSONList(copy, 'copy');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  let activeIndex = 0;

  function showSlide(nextIndex) {
    slides[activeIndex].classList.remove('is-active');
    slides[nextIndex].classList.add('is-active');
    fadeSwap(caption, captions[nextIndex]);
    fadeSwap(headline, headlines[nextIndex]);
    fadeSwap(copy, copies[nextIndex]);
    activeIndex = nextIndex;
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
      timer = start();
    }
  });
}
