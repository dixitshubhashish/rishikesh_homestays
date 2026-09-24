import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// Every page whose nav/footer/CTA links get checked for resolving to a real
// file. This is what would have caught the 2026-09-24 production outage:
// canonical URLs pointed at files that didn't actually live where the URL
// implied.
const pagesToScan = [
  'index.html',
  '404.html',
  'about-rishikesh.html',
  'contact.html',
  'haridwar-kumbh-2027.html',
  'homestays.html',
  'kedarnath-yatra.html',
  'list-your-homestay.html',
  'places-to-visit.html',
  'thanks.html',
  'things-to-do-in-rishikesh.html',
  'triveni-ghat.html',
  'hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh.html'
];

function extractInternalLinks(html) {
  const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  return [...new Set(hrefs.map((href) => href.split('#')[0].split('?')[0]))].filter(
    (href) => href && !href.startsWith('/assets/') && !href.startsWith('/api/') &&
      href !== '/site.webmanifest' && href !== '/robots.txt' && href !== '/sitemap.xml'
  );
}

// Mirrors exactly how server.js/vercel.json/_redirects resolve a clean URL
// in production: '/' -> index.html, '/<slug>' -> '<slug>.html' at the repo
// root, '/hotels/<slug>' -> 'hotels/<slug>.html'. There is no folder prefix
// added or stripped anywhere else — the URL must equal the file path.
// (A vercel.json "rewrite" bridging a URL to a file in a different folder
// looked fine locally but silently 404'd on Vercel — see the regression
// guard below.)
function resolvesToFile(urlPath) {
  if (urlPath === '/') return existsSync(join(ROOT, 'index.html'));
  return existsSync(join(ROOT, urlPath.slice(1) + '.html'));
}

test('Navigation and internal links resolve to a real file', async (t) => {
  for (const page of pagesToScan) {
    await t.test(`${page}: every internal link resolves to an existing file`, () => {
      const html = readFileSync(join(ROOT, page), 'utf-8');
      const links = extractInternalLinks(html);
      assert(links.length > 0, `${page} should have at least one internal link to check`);
      const broken = links.filter((link) => !resolvesToFile(link));
      assert.strictEqual(broken.length, 0, `${page} links to non-existent file(s): ${broken.join(', ')}`);
    });
  }

  await t.test('every canonical content page has a matching file at the repo root, not under pages/', () => {
    // Regression guard for the 2026-09-24 production outage: these pages'
    // canonical URLs dropped the /pages/ segment, but Vercel's cleanUrls
    // and Netlify's pretty-URL handling only auto-serve a clean URL from a
    // .html file at that *same* path — a cross-directory rewrite
    // (/contact -> /pages/contact.html) 404'd in production despite
    // working against the local server.js dev server. The only reliable
    // fix is a 1:1 URL-to-file match, so guard that invariant directly.
    const rootPages = [
      'about-rishikesh.html', 'contact.html', 'haridwar-kumbh-2027.html',
      'homestays.html', 'kedarnath-yatra.html', 'list-your-homestay.html',
      'places-to-visit.html', 'thanks.html', 'things-to-do-in-rishikesh.html',
      'triveni-ghat.html'
    ];
    rootPages.forEach((file) => {
      assert(existsSync(join(ROOT, file)), `${file} should exist at the repo root so its clean URL resolves natively on Vercel/Netlify`);
    });
    assert(!existsSync(join(ROOT, 'pages')), 'the old pages/ folder should no longer exist — files moved to the repo root');
  });

  await t.test('404.html has contact details and an auto-redirect that can be cancelled', () => {
    const content = readFileSync(join(ROOT, '404.html'), 'utf-8');
    assert(content.includes('noindex'), 'should not be indexed by search engines');
    assert(content.includes('tel:+918050091290'), 'should offer a phone contact');
    assert(content.includes('wa.me/918050091290'), 'should offer a WhatsApp contact');
    assert(content.includes('mailto:hello@rishikeshhomestays.com'), 'should offer an email contact');
    assert(content.includes("seconds = 20"), 'should auto-redirect home after 20 seconds');
    assert(content.includes("window.location.href = '/'"), 'should redirect to the homepage');
    assert(content.includes('redirect-cancel'), 'should let the visitor cancel the auto-redirect');
    assert(content.includes('Om Namah Shivaya'), 'should have the spiritual chant feel');
    assert(content.includes('Har Har Gange'), 'should have the spiritual chant feel');
    assert(content.includes('error-diver'), 'should have the animated cliff-dive visual');
  });
});
