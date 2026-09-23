// Simple in-page tab switcher for pages with multiple content panels (e.g.
// Places to Visit / Restaurants & Cafes sharing one URL). Supports
// deep-linking via URL hash so old bookmarked/shared links to a specific
// tab still land on the right panel.
export function setupPageTabs() {
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  if (!tabButtons.length) return;

  const validIds = [...tabButtons].map((btn) => btn.dataset.tabTarget);

  function activate(tabId) {
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tabTarget === tabId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tabId;
    });
  }

  const tabsContainer = tabButtons[0].closest('[role="tablist"]') || tabButtons[0].parentElement;

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activate(btn.dataset.tabTarget);
      history.replaceState(null, '', `#${btn.dataset.tabTarget}`);
      // The two panels can have very different heights (e.g. 22 place
      // cards vs. a handful of restaurant cards). Without this, switching
      // tabs while scrolled down can leave the visitor stranded in blank
      // space or mid-way through unrelated content — scroll back to the
      // tab switcher itself so every switch lands somewhere sensible.
      tabsContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const requestedTab = window.location.hash.replace('#', '');
  activate(validIds.includes(requestedTab) ? requestedTab : validIds[0]);
}
