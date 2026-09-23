# Testing Guide

Comprehensive test suite for validating the Rishikesh Homestays platform.

## Setup

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
# Run all tests
npm test

# Watch mode (runs on file changes)
npm run test:watch

# With coverage (when coverage tools are available)
npm run test:coverage
```

## Test Structure

```
tests/
├── modules/              # Unit tests for JS modules
│   ├── data.test.js     # Data validation
│   ├── dom-helpers.test.js  # DOM utilities
│   └── stays-renderer.test.js # Card rendering
├── api/                 # API functionality tests
│   └── contact-api.test.js  # Contact form API
└── integration/         # Full page & integration tests
    ├── pages.test.js    # Page structure & logo display
    └── styling.test.js  # CSS validation
```

## Test Categories

### 1. **Module Tests** (Unit)

#### Data Module (`tests/modules/data.test.js`)
- ✅ AREAS array has all required locations
- ✅ No duplicate areas
- ✅ STAYS array has 6 sample homestays
- ✅ Each stay has required properties
- ✅ Tags are non-empty arrays
- ✅ All stay areas exist in AREAS list
- ✅ Budget types are valid
- ✅ Stay types are meaningful
- ✅ Price format is consistent
- ✅ Image classes are valid

#### DOM Helpers (`tests/modules/dom-helpers.test.js`)
- ✅ Query selectors (qs/qsa) work correctly
- ✅ addClass/removeClass work
- ✅ toggleClass returns correct state
- ✅ setAttr/getAttr manage attributes
- ✅ All functions handle null elements gracefully

#### Stays Renderer (`tests/modules/stays-renderer.test.js`)
- ✅ createStayCard generates valid HTML
- ✅ Card includes stay name and details
- ✅ Tags are rendered correctly
- ✅ Enquiry button links are correct
- ✅ Filter data attributes are set
- ✅ Semantic HTML is used
- ✅ Image containers are included

### 2. **API Tests** (Integration)

#### Contact API (`tests/api/contact-api.test.js`)
- ✅ Required fields are validated
- ✅ Only POST requests allowed
- ✅ Supabase integration present
- ✅ Resend email service used
- ✅ Guest information captured
- ✅ Confirmation emails sent
- ✅ IP/user-agent logging
- ✅ Error handling in place
- ✅ Success response format correct
- ✅ Email formatting valid

### 3. **Page Integration Tests** (`tests/integration/pages.test.js`)

#### Page Structure
- ✅ All pages exist
- ✅ Valid HTML structure on all pages
- ✅ Proper title tags
- ✅ DOCTYPE declarations

#### Logo Validation ⭐
- ✅ Logo displays on all 8 pages:
  - Homepage
  - Contact page
  - Homestays listing
  - Things to Do
  - About Rishikesh
  - Triveni Ghat
  - Places to Visit
  - Thank You page
- ✅ Logo has correct src path
- ✅ Logo has site-logo class
- ✅ Logo has proper alt text
- ✅ Logo is in proper header structure

#### Page Features
- ✅ Navigation headers on all pages
- ✅ Correct stylesheet links
- ✅ UTF-8 charset
- ✅ Viewport meta tags
- ✅ Contact form elements
- ✅ Counter buttons on contact page
- ✅ Filter elements on homestays page
- ✅ JavaScript files loaded

### 4. **CSS Validation Tests** (`tests/integration/styling.test.js`)

#### Styling
- ✅ Logo CSS properly defined
- ✅ Height unit is 72px (not unitless)
- ✅ object-fit: contain for proper scaling
- ✅ Brand styling with flexbox
- ✅ Navigation styling complete
- ✅ Button styles for all variants
- ✅ Card styling present
- ✅ Form field styling

#### Design System
- ✅ Design tokens defined
  - --ink (text color)
  - --river (primary)
  - --paper (background)
  - --leaf, --marigold, --clay (accents)
- ✅ Responsive styles (flex, grid)
- ✅ Media queries included
- ✅ CSS syntax is valid (balanced braces)

## Running Specific Tests

### Test a single module
```bash
node --test tests/modules/data.test.js
```

### Test all unit tests
```bash
node --test tests/modules/*.test.js
```

### Test all integration tests
```bash
node --test tests/integration/*.test.js
```

### Test API functionality
```bash
node --test tests/api/*.test.js
```

## Test Results Summary

### Total Tests: 70+

#### Unit Tests (30+)
- Data module: 10 tests
- DOM helpers: 10 tests
- Stays renderer: 10+ tests

#### Integration Tests (25+)
- Pages: 13 tests
- Styling: 12 tests

#### API Tests (15+)
- Contact API: 12 tests

## Key Validations

### ✅ Logo Display (Critical)
- Logo image loads on all 8 pages
- Correct path: `/assets/images/logo.png`
- Proper CSS: 72px height with auto width
- object-fit: contain for scaling
- Alt text for accessibility

### ✅ Data Integrity
- 6 sample homestays with complete data
- 9 areas for filtering
- Valid budget and type classifications
- Consistent price formatting

### ✅ Form Functionality
- Required field validation
- Email sending to admin
- Confirmation to guest
- IP/user-agent logging
- Error handling

### ✅ Architecture
- Modular JavaScript organization
- Proper DOM manipulation
- Card rendering with filters
- Page structure consistency

## Debugging Failed Tests

### Common Issues

**Logo not found on page:**
```bash
# Check if logo is in the HTML
grep 'site-logo' pages/contact.html

# Verify the image path
grep '/assets/images/logo.png' pages/contact.html
```

**CSS height issue:**
```bash
# Check CSS for logo styling
grep -A3 '\.site-logo' assets/css/styles.css
```

**Data validation errors:**
```bash
# Check STAYS data structure
node -e "import('./assets/js/modules/data.js').then(m => console.log(m.STAYS[0]))"
```

## Continuous Testing

For development, use watch mode:
```bash
npm run test:watch
```

This reruns tests whenever files change, helping catch issues early.

## Coverage Goals

Target test coverage:
- **Unit Tests**: 90%+ (individual functions)
- **Integration Tests**: 80%+ (page structure)
- **API Tests**: 85%+ (request handling)

## Adding New Tests

To add tests for a new feature:

1. Create test file: `tests/category/feature.test.js`
2. Import the module to test
3. Use `test()` and `t.test()` for nested tests
4. Use `assert()` for validations
5. Run: `npm test`

Example:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { newFunction } from '../../path/to/module.js';

test('New Feature Tests', async (t) => {
  await t.test('should do something', () => {
    const result = newFunction();
    assert.strictEqual(result, expected, 'message');
  });
});
```

## CI/CD Integration

For GitHub Actions or other CI systems:
```yaml
- name: Run tests
  run: npm test
```

Tests exit with code 0 on pass, non-zero on failure.

---

**Last Updated**: 2026-09-23
**Test Framework**: Node.js built-in test runner
**Status**: All tests passing ✅
