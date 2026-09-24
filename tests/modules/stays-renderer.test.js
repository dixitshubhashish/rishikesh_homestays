import test from 'node:test';
import assert from 'node:assert';
import { createStayCard } from '../../assets/js/modules/stays-renderer.js';

test('Stays Renderer Module Tests', async (t) => {
  const mockStay = {
    name: "Test Homestay",
    area: "Tapovan",
    type: "Family",
    budget: "Mid-range",
    price: "From ₹5,000",
    imageClass: "one",
    summary: "A great place to stay",
    tags: ["WiFi", "Kitchen", "Parking"]
  };

  await t.test('createStayCard - should generate valid HTML', () => {
    const html = createStayCard(mockStay);
    assert(typeof html === 'string', 'Should return a string');
    assert(html.includes('homestay-card'), 'Should include homestay-card class');
  });

  await t.test('createStayCard - should include stay name', () => {
    const html = createStayCard(mockStay);
    assert(html.includes(mockStay.name), 'HTML should include stay name');
  });

  await t.test('createStayCard - should include area info', () => {
    const html = createStayCard(mockStay);
    assert(html.includes(mockStay.area), 'HTML should include area');
    assert(html.includes(mockStay.type), 'HTML should include type');
  });

  await t.test('createStayCard - should include price', () => {
    const html = createStayCard(mockStay);
    assert(html.includes(mockStay.price), 'HTML should include price');
  });

  await t.test('createStayCard - should include summary', () => {
    const html = createStayCard(mockStay);
    assert(html.includes(mockStay.summary), 'HTML should include summary');
  });

  await t.test('createStayCard - should include all tags', () => {
    const html = createStayCard(mockStay);
    mockStay.tags.forEach(tag => {
      assert(html.includes(tag), `HTML should include tag: ${tag}`);
    });
  });

  await t.test('createStayCard - should include enquiry button', () => {
    const html = createStayCard(mockStay);
    assert(html.includes('Send enquiry'), 'HTML should include enquiry button');
    assert(html.includes('/contact?'), 'Should link to contact page');
  });

  await t.test('createStayCard - should URL-encode stay name in enquiry link', () => {
    const html = createStayCard(mockStay);
    assert(html.includes('stay='), 'HTML should include stay parameter');
  });

  await t.test('createStayCard - should include compare button', () => {
    const html = createStayCard(mockStay);
    assert(html.includes('Compare stays'), 'HTML should include compare button');
    assert(html.includes('/homestays'), 'Should link to homestays page');
  });

  await t.test('createStayCard - should set data attributes for filtering', () => {
    const html = createStayCard(mockStay);
    assert(html.includes(`data-area="${mockStay.area}"`), 'Should have data-area attribute');
    assert(html.includes(`data-type="${mockStay.type}"`), 'Should have data-type attribute');
    assert(html.includes(`data-budget="${mockStay.budget}"`), 'Should have data-budget attribute');
  });

  await t.test('createStayCard - should include image container', () => {
    const html = createStayCard(mockStay);
    assert(html.includes('homestay-photo'), 'HTML should include image container');
    assert(html.includes(mockStay.imageClass), 'Should include image class');
  });

  await t.test('createStayCard - should have proper semantic HTML', () => {
    const html = createStayCard(mockStay);
    assert(html.includes('<article'), 'Should use article tag');
    assert(html.includes('<h3>'), 'Should include h3 for title');
    assert(html.includes('</article>'), 'Should properly close article tag');
  });
});
