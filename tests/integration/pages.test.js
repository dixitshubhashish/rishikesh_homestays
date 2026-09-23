import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const testPages = [
  { path: 'index.html', name: 'Homepage' },
  { path: 'pages/contact.html', name: 'Contact Page' },
  { path: 'pages/homestays.html', name: 'Homestays Page' },
  { path: 'pages/things-to-do-in-rishikesh.html', name: 'Things to Do' },
  { path: 'pages/about-rishikesh.html', name: 'About Rishikesh' },
  { path: 'pages/triveni-ghat.html', name: 'Triveni Ghat' },
  { path: 'pages/places-to-visit.html', name: 'Places to Visit' },
  { path: 'pages/thanks.html', name: 'Thank You Page' },
  { path: 'pages/kedarnath-yatra.html', name: 'Kedarnath & Garhwal Gateway' },
  { path: 'pages/list-your-homestay.html', name: 'List Your Homestay' },
  { path: 'pages/haridwar-kumbh-2027.html', name: 'Kumbh 2027' }
];

function readPage(filePath) {
  try {
    return readFileSync(join(process.cwd(), filePath), 'utf-8');
  } catch (error) {
    return null;
  }
}

test('Page Integration Tests', async (t) => {
  await t.test('All pages should exist', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(content !== null, `${name} (${path}) should exist`);
    });
  });

  await t.test('All pages should have valid HTML structure', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(content.includes('<!doctype html>'), `${name} should have DOCTYPE`);
      assert(content.includes('<html'), `${name} should have html tag`);
      assert(content.includes('</html>'), `${name} should close html tag`);
      assert(content.includes('<head>'), `${name} should have head section`);
      assert(content.includes('<body>'), `${name} should have body section`);
    });
  });

  await t.test('All pages should have proper title', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(content.includes('<title>'), `${name} should have title tag`);
      assert(content.includes('</title>'), `${name} should close title tag`);
      const titleMatch = content.match(/<title>(.*?)<\/title>/);
      assert(titleMatch && titleMatch[1].length > 0, `${name} should have non-empty title`);
    });
  });

  await t.test('Logo should display on all pages', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(
        content.includes('src="/assets/images/logo.png"'),
        `${name} should include logo image`
      );
      assert(
        content.includes('class="site-logo"'),
        `${name} should have site-logo class`
      );
    });
  });

  await t.test('internal page links never expose a .html extension', () => {
    // Regression guard: URLs should read as /pages/contact, not
    // /pages/contact.html — the server 301-redirects the .html form to the
    // clean one, and Netlify's _redirects does the same in production.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      const badLinks = content.match(/href="\/pages\/[a-z-]+\.html/g) || [];
      assert.strictEqual(badLinks.length, 0, `${name} has internal link(s) still showing .html: ${badLinks.join(', ')}`);
    });
  });

  await t.test('every page should declare a favicon', () => {
    // Regression guard: only index.html had <link rel="icon"> at one point;
    // every other page silently had no favicon at all.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(content.includes('rel="icon"'), `${name} should have a favicon link`);
    });
  });

  await t.test('All pages should have navigation header', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(
        content.includes('<header class="site-header">'),
        `${name} should have site header`
      );
      assert(
        content.includes('class="brand"'),
        `${name} should have brand element`
      );
    });
  });

  await t.test('Logo should have proper alt text', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(
        content.includes('alt="Rishikesh Homestays"'),
        `${name} logo should have alt text`
      );
    });
  });

  await t.test('All pages should link to correct stylesheets', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(
        content.includes('href="/assets/css/styles.css"'),
        `${name} should link to styles.css`
      );
    });
  });

  await t.test('All pages should have proper charset', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(
        content.includes('charset="utf-8"') || content.includes('charset=utf-8'),
        `${name} should have UTF-8 charset`
      );
    });
  });

  await t.test('All pages should have viewport meta tag', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(
        content.includes('name="viewport"'),
        `${name} should have viewport meta tag`
      );
    });
  });

  await t.test('Contact page should have form', () => {
    const content = readPage('pages/contact.html');
    assert(content.includes('id="contactForm"'), 'Should have contact form');
    assert(content.includes('name="name"'), 'Should have name field');
    assert(content.includes('name="phone"'), 'Should have phone field');
    assert(content.includes('name="details"'), 'Should have details field');
  });

  await t.test('Contact page should have counter buttons', () => {
    const content = readPage('pages/contact.html');
    assert(content.includes('class="counter-btn"'), 'Should have counter buttons');
    assert(content.includes('data-counter="adults"'), 'Should have adults counter');
    assert(content.includes('data-counter="children"'), 'Should have children counter');
  });

  await t.test('Homestays page should have filter elements', () => {
    const content = readPage('pages/homestays.html');
    assert(content.includes('data-filter-area'), 'Should have area filter');
    assert(content.includes('data-filter-type'), 'Should have type filter');
    assert(content.includes('data-filter-budget'), 'Should have budget filter');
  });

  await t.test('All pages should load required JavaScript', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      const hasScripts = content.includes('<script') && content.includes('.js');
      assert(hasScripts, `${name} should load JavaScript files`);
    });
  });

  await t.test('site.js and contact.js should always load as type="module"', () => {
    // Regression guard: these shims use `import` statements. Loading them as
    // a plain <script src> (no type="module") throws a silent SyntaxError in
    // the browser and breaks nav/search/forms on that page.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      const scriptTags = content.match(/<script[^>]*src="[^"]*\/(site|contact)\.js"[^>]*>/g) || [];
      scriptTags.forEach((tag) => {
        assert(tag.includes('type="module"'), `${name}: ${tag} must be type="module"`);
      });
    });
  });

  await t.test('every page has the same number of primary nav links', () => {
    // Regression guard for the "menu headers are different count on
    // different pages" bug: list-your-homestay.html and thanks.html each
    // had a different, incomplete nav at one point.
    const counts = testPages.map(({ path, name }) => {
      const content = readPage(path);
      const navMatch = content.match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
      assert(navMatch, `${name} should have a primary nav`);
      const linkCount = (navMatch[0].match(/<a /g) || []).length;
      return { name, linkCount };
    });
    const expected = counts[0].linkCount;
    counts.forEach(({ name, linkCount }) => {
      assert.strictEqual(linkCount, expected, `${name} nav has ${linkCount} links, expected ${expected} (same as ${counts[0].name})`);
    });
  });

  await t.test('every page has a nav-toggle button for mobile', () => {
    // Regression guard: thanks.html previously had no hamburger button at
    // all, so its nav never collapsed on mobile like every other page.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(content.includes('data-nav-toggle'), `${name} should have a nav-toggle button`);
    });
  });

  await t.test('every page has the full rich footer, not a stripped-down one', () => {
    // Regression guard: only index.html used to have the rich footer
    // (brand/contact/social/nav columns); every other page had a bare
    // one-line footer, and thanks.html had no footer at all.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(content.includes('class="rhs-footer"'), `${name} should use the rich footer`);
      assert(content.includes('rhs-footer-brand'), `${name} footer should include the brand column`);
      assert(content.includes('rhs-social'), `${name} footer should include social links`);
    });
  });

  await t.test('every page links to the key new pages from its nav', () => {
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(content.includes('/pages/kedarnath-yatra'), `${name} nav should link to the Kedarnath page`);
      assert(content.includes('/pages/list-your-homestay'), `${name} nav should link to List Your Homestay`);
      assert(content.includes('/pages/haridwar-kumbh-2027'), `${name} nav should link to the Kumbh 2027 page`);
    });
  });

  await t.test('no page still links to the old standalone Restaurants & Cafes page', () => {
    // Regression guard: that page was merged into Places to Visit as an
    // in-page tab and removed from disk.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(!content.includes('/pages/restaurants-cafes'), `${name} should not link to the removed restaurants-cafes page`);
    });
  });

  await t.test('no page still links to the old gateway-to-kedarnath URL', () => {
    // Regression guard: this page was renamed to kedarnath-yatra.html but
    // never got a server.js/vercel.json/_redirects entry redirecting the
    // old URL — anyone with it bookmarked or indexed would 404.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(!content.includes('/pages/gateway-to-kedarnath'), `${name} should not link to the renamed gateway-to-kedarnath page`);
    });
    ['server.js', 'vercel.json', '_redirects'].forEach((file) => {
      const content = readFileSync(join(process.cwd(), file), 'utf-8');
      assert(content.includes('gateway-to-kedarnath'), `${file} should redirect the old gateway-to-kedarnath URL to kedarnath-yatra`);
    });
  });

  await t.test('Places to Visit page has both the Places and Restaurants & Cafes tabs', () => {
    const content = readPage('pages/places-to-visit.html');
    assert(content.includes('data-tab-target="places"'), 'Should have a Places tab button');
    assert(content.includes('data-tab-target="restaurants"'), 'Should have a Restaurants tab button');
    assert(content.includes('data-tab-panel="places"'), 'Should have a places panel');
    assert(content.includes('data-tab-panel="restaurants"'), 'Should have a restaurants panel');
    assert(content.includes('Little Buddha Cafe'), 'Should include the merged restaurant content');
  });

  await t.test('Kumbh 2027 page exists with a clear "not confirmed" caveat', () => {
    const content = readPage('pages/haridwar-kumbh-2027.html');
    assert(content.includes('not yet officially confirmed') || content.includes('reported, not confirmed') || content.includes('Treat this list as reported'), 'Should caveat the reported dates clearly');
    assert(content.includes('cta-band'), 'Should have a booking CTA');
  });

  await t.test('every page loads the WhatsApp widget, not just the homepage', () => {
    // Regression guard: the widget originally only existed on index.html.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      assert(content.includes('whatsapp-widget.css'), `${name} should load the WhatsApp widget stylesheet`);
      assert(content.includes('setupWhatsAppWidget'), `${name} should initialize the WhatsApp widget`);
      assert(content.includes('flatpickr.min.js'), `${name} should load flatpickr (used by the widget's date pickers)`);
      assert(content.includes('libphonenumber-min.js'), `${name} should load libphonenumber (used by the widget's phone validation)`);
    });
  });

  await t.test('WhatsApp widget submit button lives outside the form, in a fixed footer', () => {
    // Regression guard: the button used to be the last item inside the long
    // scrollable form, so it was invisible without scrolling the whole way
    // down. It's now in the popup's fixed footer, associated with the form
    // via the standard HTML `form` attribute. (The widget's markup lives in
    // a JS template literal, not in any page's static HTML.)
    const content = readFileSync(join(process.cwd(), 'assets/js/modules/whatsapp-widget.js'), 'utf-8');
    assert(content.includes('form="whatsapp-form"'), 'Submit button should reference the form by id from outside it');
    const formBlock = content.match(/<form id="whatsapp-form"[\s\S]*?<\/form>/)[0];
    assert(!formBlock.includes('Send on WhatsApp'), 'Submit button should not be nested inside the form anymore');
    const footerBlock = content.match(/<div class="whatsapp-footer">[\s\S]*?<\/div>/)[0];
    assert(footerBlock.includes('Send on WhatsApp'), 'Submit button should be in the fixed footer');
  });

  await t.test('Homestays page "Ask for a shortlist" form saves to the database, not Netlify', () => {
    // Regression guard: this form used to submit via data-netlify="true" to
    // /pages/thanks.html and never reached /api/contact or BigQuery.
    const content = readPage('pages/homestays.html');
    assert(!content.includes('data-netlify'), 'Should not use Netlify Forms');
    assert(content.includes('id="contactForm"'), 'Should reuse the validated contact form pattern');
    assert(content.includes('id="country"'), 'Should have a country selector for phone validation');
  });

  await t.test('List Your Homestay page has a working application form', () => {
    const content = readPage('pages/list-your-homestay.html');
    assert(content.includes('id="hostForm"'), 'Should have the host application form');
    assert(content.includes('name="phone"'), 'Should have a phone field');
    assert(content.includes('name="details"'), 'Should have a details field (required by /api/contact)');
    assert(content.includes('/assets/js/modules/host-form.js'), 'Should load host-form.js');
  });

  await t.test('Kedarnath & Garhwal page has a booking CTA', () => {
    const content = readPage('pages/kedarnath-yatra.html');
    assert(content.includes('cta-band'), 'Should have a call-to-action band');
    assert(content.includes('/pages/contact'), 'CTA should link to the booking/contact page');
  });

  await t.test('every page that loads flatpickr.min.js also loads flatpickr.min.css', () => {
    // Regression guard: several pages had the WhatsApp widget's flatpickr.min.js
    // script but were missing flatpickr.min.css. Without the stylesheet, the
    // calendar popup (normally absolutely-positioned and hidden until opened)
    // renders unstyled as a large block of visible content dumped at the end
    // of <body> — appearing as "random content after the footer" on the page.
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      const hasJs = content.includes('flatpickr.min.js');
      const hasCss = content.includes('flatpickr.min.css');
      if (hasJs) {
        assert(hasCss, `${name} loads flatpickr.min.js but not flatpickr.min.css — the calendar will render unstyled and inflate page height`);
      }
    });
  });

  await t.test('every footer Explore column links to every core content page', () => {
    // Regression guard: kedarnath-yatra.html's footer link was missing from
    // every OTHER page's Explore column (only present on its own page),
    // and triveni-ghat.html had the same gap earlier. Checking the full set
    // here so a future page addition can't silently repeat this.
    const corePages = [
      '/pages/things-to-do-in-rishikesh',
      '/pages/places-to-visit',
      '/pages/about-rishikesh',
      '/pages/haridwar-kumbh-2027',
      '/pages/triveni-ghat',
      '/pages/kedarnath-yatra'
    ];
    testPages.forEach(({ path, name }) => {
      const content = readPage(path);
      const footerMatch = content.match(/<footer[\s\S]*$/);
      assert(footerMatch, `${name} should have a footer`);
      const footerHtml = footerMatch[0];
      corePages.forEach((href) => {
        assert(footerHtml.includes(`href="${href}"`), `${name}'s footer is missing a link to ${href}`);
      });
    });
  });
});
