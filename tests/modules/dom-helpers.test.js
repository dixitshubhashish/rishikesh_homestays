import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import * as domHelpers from '../../assets/js/modules/dom-helpers.js';

test('DOM Helpers Module Tests', async (t) => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="test-container">
          <button id="test-btn" class="btn">Click me</button>
          <input id="test-input" type="text" value="">
          <p id="missing-element-never-exists"></p>
        </div>
      </body>
    </html>
  `);

  global.document = dom.window.document;
  global.window = dom.window;

  await t.test('qs - should query single element', () => {
    const btn = domHelpers.qs('#test-btn');
    assert(btn !== null, 'Should find element by ID');
    assert.strictEqual(btn.id, 'test-btn', 'Should return correct element');
  });

  await t.test('qs - should return null for non-existent element', () => {
    const notFound = domHelpers.qs('#does-not-exist');
    assert.strictEqual(notFound, null, 'Should return null for non-existent element');
  });

  await t.test('qsa - should query multiple elements', () => {
    const allDivs = domHelpers.qsa('div');
    assert(Array.isArray(allDivs), 'qsa should return an array');
    assert(allDivs.length > 0, 'Should find at least one div');
  });

  await t.test('addClass - should add class to element', () => {
    const btn = domHelpers.qs('#test-btn');
    domHelpers.addClass(btn, 'active');
    assert(btn.classList.contains('active'), 'Element should have active class');
  });

  await t.test('addClass - should handle null element gracefully', () => {
    assert.doesNotThrow(() => {
      domHelpers.addClass(null, 'some-class');
    }, 'Should not throw when element is null');
  });

  await t.test('removeClass - should remove class from element', () => {
    const btn = domHelpers.qs('#test-btn');
    btn.classList.add('test-class');
    domHelpers.removeClass(btn, 'test-class');
    assert(!btn.classList.contains('test-class'), 'Class should be removed');
  });

  await t.test('toggleClass - should toggle class on element', () => {
    const btn = domHelpers.qs('#test-btn');
    const hasClass = domHelpers.toggleClass(btn, 'toggle-test');
    assert.strictEqual(hasClass, true, 'Should return true when class is added');

    const hasClassAfter = domHelpers.toggleClass(btn, 'toggle-test');
    assert.strictEqual(hasClassAfter, false, 'Should return false when class is removed');
  });

  await t.test('setAttr - should set attribute on element', () => {
    const input = domHelpers.qs('#test-input');
    domHelpers.setAttr(input, 'placeholder', 'Enter text');
    assert.strictEqual(input.getAttribute('placeholder'), 'Enter text', 'Attribute should be set');
  });

  await t.test('setAttr - should handle null element gracefully', () => {
    assert.doesNotThrow(() => {
      domHelpers.setAttr(null, 'attr', 'value');
    }, 'Should not throw when element is null');
  });

  await t.test('getAttr - should get attribute from element', () => {
    const btn = domHelpers.qs('#test-btn');
    domHelpers.setAttr(btn, 'data-test', 'test-value');
    const value = domHelpers.getAttr(btn, 'data-test');
    assert.strictEqual(value, 'test-value', 'Should return correct attribute value');
  });

  await t.test('getAttr - should return null for non-existent attribute', () => {
    const btn = domHelpers.qs('#test-btn');
    const value = domHelpers.getAttr(btn, 'non-existent-attr');
    assert.strictEqual(value, null, 'Should return null for missing attribute');
  });

  await t.test('getAttr - should handle null element gracefully', () => {
    const value = domHelpers.getAttr(null, 'any-attr');
    assert.strictEqual(value, null, 'Should return null when element is null');
  });
});
