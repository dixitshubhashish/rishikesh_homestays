import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';

function readCSS() {
  return readFileSync(join(process.cwd(), 'assets/css/styles.css'), 'utf-8');
}

test('CSS and Styling Validation Tests', async (t) => {
  const css = readCSS();

  await t.test('CSS file should exist and have content', () => {
    assert(css.length > 0, 'CSS file should have content');
  });

  await t.test('Logo styling should be properly defined', () => {
    assert(css.includes('.site-logo'), 'Should have .site-logo class');
    assert(css.includes('height: 72px'), 'Logo height should be 72px with proper unit');
    assert(css.includes('width: auto'), 'Logo width should be auto');
    assert(css.includes('display: block'), 'Logo should be block display');
  });

  await t.test('Logo should have object-fit property', () => {
    assert(css.includes('object-fit: contain'), 'Logo should have object-fit: contain');
  });

  await t.test('Brand styling should be defined', () => {
    assert(css.includes('.brand'), 'Should have .brand class');
    assert(css.includes('display:flex'), 'Brand should use flexbox');
  });

  await t.test('Navigation styling should be defined', () => {
    assert(css.includes('.site-nav'), 'Should have navigation styles');
    assert(css.includes('.site-header'), 'Should have header styles');
  });

  await t.test('Button styling should be complete', () => {
    assert(css.includes('.btn'), 'Should have .btn class');
    assert(css.includes('.btn-primary'), 'Should have .btn-primary class');
    assert(css.includes('.btn-secondary'), 'Should have .btn-secondary class');
    assert(css.includes('.btn-whatsapp'), 'Should have .btn-whatsapp class');
  });

  await t.test('Card styling should be complete', () => {
    assert(css.includes('.homestay-card'), 'Should have .homestay-card class');
    assert(css.includes('.card-body'), 'Should have .card-body class');
    assert(css.includes('.tag'), 'Should have .tag class');
  });

  await t.test('Form styling should be present', () => {
    assert(css.includes('.field'), 'Should have .field class for form fields');
    assert(css.includes('input'), 'Should style input elements');
    assert(css.includes('textarea'), 'Should style textarea elements');
  });

  await t.test('Footer styling should be defined', () => {
    assert(css.includes('.rhs-footer'), 'Should have footer styles');
    assert(css.includes('.rhs-footer-logo'), 'Should have footer logo styles');
  });

  await t.test('Design tokens should be defined', () => {
    assert(css.includes('--ink'), 'Should define --ink color');
    assert(css.includes('--river'), 'Should define --river color');
    assert(css.includes('--paper'), 'Should define --paper color');
    assert(css.includes('--leaf'), 'Should define --leaf color');
    assert(css.includes('--marigold'), 'Should define --marigold color');
  });

  await t.test('Responsive styles should be present', () => {
    assert(css.includes('flex'), 'Should use flexbox for responsive layout');
    assert(css.includes('grid'), 'Should use grid where appropriate');
  });

  await t.test('CSS should have no broken syntax', () => {
    const braceCount = (css.match(/{/g) || []).length;
    const closingBraceCount = (css.match(/}/g) || []).length;
    assert.strictEqual(braceCount, closingBraceCount, 'CSS braces should be balanced');
  });

  await t.test('Media queries should be included for mobile', () => {
    assert(
      css.includes('@media'),
      'Should have media queries for responsive design'
    );
  });
});
