import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression guard for a real bug: `setupPageTabs` was imported into
// site.js but never actually called in the DOMContentLoaded handler, so
// the Places/Restaurants tabs silently never activated on any page. A
// static source check like this catches "imported but never invoked"
// mistakes that unit tests on the individual module can't catch, since
// page-tabs.test.js only proves the function works in isolation, not that
// site.js actually wires it up.

function namedImportsFrom(source) {
  const names = [];
  const importRegex = /^import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"];?$/gm;
  let match;
  while ((match = importRegex.exec(source))) {
    match[1].split(',').forEach((raw) => {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.push(name);
    });
  }
  return names;
}

test('site.js', async (t) => {
  const source = readFileSync(join(process.cwd(), 'assets/js/site.js'), 'utf-8');

  await t.test('every named import is actually used somewhere in the file', () => {
    const imported = namedImportsFrom(source);
    assert(imported.length > 0, 'sanity check: should find some imports to verify');

    imported.forEach((name) => {
      // Count occurrences of the identifier outside the import line itself.
      // Every import should appear again at least once, either called
      // directly (setupX()) or assigned onto window (window.setupX = setupX).
      const usageRegex = new RegExp(`\\b${name}\\b`, 'g');
      const occurrences = (source.match(usageRegex) || []).length;
      assert(
        occurrences > 1,
        `"${name}" is imported but never referenced again — it's probably dead code or, worse, a function that was meant to be called but isn't (exactly the bug that shipped with setupPageTabs).`
      );
    });
  });

  await t.test('setupPageTabs is called inside the DOMContentLoaded handler, not just imported', () => {
    const domReadyBlock = source.match(/document\.addEventListener\("DOMContentLoaded",[\s\S]*?\}\);/);
    assert(domReadyBlock, 'Should have a DOMContentLoaded handler');
    assert(domReadyBlock[0].includes('setupPageTabs()'), 'setupPageTabs() should be invoked inside the DOMContentLoaded handler');
  });
});
