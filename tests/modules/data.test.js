import test from 'node:test';
import assert from 'node:assert';
import { AREAS, STAYS } from '../../assets/js/modules/data.js';

test('Data Module Tests', async (t) => {
  await t.test('AREAS - should have required locations', () => {
    assert.strictEqual(Array.isArray(AREAS), true, 'AREAS should be an array');
    assert(AREAS.length > 0, 'AREAS should not be empty');
    assert(AREAS.includes('Tapovan'), 'Should include Tapovan');
    assert(AREAS.includes('Triveni Ghat'), 'Should include Triveni Ghat');
    assert(AREAS.includes('Neelkanth Road'), 'Should include Neelkanth Road');
  });

  await t.test('AREAS - should have no duplicates', () => {
    const uniqueAreas = new Set(AREAS);
    assert.strictEqual(AREAS.length, uniqueAreas.size, 'AREAS should have no duplicates');
  });

  await t.test('STAYS - should have sample homestays', () => {
    assert.strictEqual(Array.isArray(STAYS), true, 'STAYS should be an array');
    assert(STAYS.length > 0, 'STAYS should not be empty');
    assert.strictEqual(STAYS.length, 6, 'Should have 6 sample homestays');
  });

  await t.test('STAYS - each stay should have required properties', () => {
    const requiredProps = ['name', 'area', 'type', 'budget', 'price', 'imageClass', 'summary', 'tags'];

    STAYS.forEach((stay, index) => {
      requiredProps.forEach(prop => {
        assert(stay.hasOwnProperty(prop), `Stay ${index} missing property: ${prop}`);
      });
    });
  });

  await t.test('STAYS - tags should be arrays', () => {
    STAYS.forEach((stay, index) => {
      assert(Array.isArray(stay.tags), `Stay ${index} tags should be an array`);
      assert(stay.tags.length > 0, `Stay ${index} should have at least one tag`);
    });
  });

  await t.test('STAYS - all areas should exist in AREAS', () => {
    STAYS.forEach((stay, index) => {
      assert(AREAS.includes(stay.area), `Stay ${index} area "${stay.area}" not in AREAS list`);
    });
  });

  await t.test('STAYS - budget types should be consistent', () => {
    const validBudgets = ['Budget', 'Mid-range', 'Premium'];
    STAYS.forEach((stay, index) => {
      assert(validBudgets.includes(stay.budget), `Stay ${index} has invalid budget: ${stay.budget}`);
    });
  });

  await t.test('STAYS - type should be meaningful', () => {
    const validTypes = ['Family', 'Wellness', 'Nature', 'Workation', 'Couples'];
    STAYS.forEach((stay, index) => {
      assert(validTypes.includes(stay.type), `Stay ${index} has invalid type: ${stay.type}`);
    });
  });

  await t.test('STAYS - price format should be consistent', () => {
    STAYS.forEach((stay, index) => {
      assert(stay.price.includes('₹'), `Stay ${index} price should include rupee symbol`);
      assert(stay.price.includes('From'), `Stay ${index} price format should start with "From"`);
    });
  });

  await t.test('STAYS - imageClass should be valid', () => {
    // Each class must have a matching .homestay-photo.<class> background
    // rule in styles.css — 'advaitam-ganga' is that listing's own real
    // photo, kept separate from 'one' so it doesn't collide with the other
    // stay that still uses the generic 'one' fallback image.
    const validClasses = ['one', 'two', 'three', 'advaitam-ganga'];
    STAYS.forEach((stay, index) => {
      assert(validClasses.includes(stay.imageClass), `Stay ${index} has invalid imageClass: ${stay.imageClass}`);
    });
  });
});
