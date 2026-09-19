import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LANGUAGE, normalizeLanguage, translate } from '../web/i18n.js';

test('language normalization falls back to Korean', () => {
  assert.equal(DEFAULT_LANGUAGE, 'ko');
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage('fr'), 'ko');
  assert.equal(normalizeLanguage(undefined), 'ko');
});

test('English title, subtitle and settings labels are translated', () => {
  assert.equal(translate('en', 'title'), 'A Little Forest Underwater');
  assert.equal(translate('en', 'subtitle'), 'Slowly flowing light, life swimming freely.');
  assert.equal(translate('en', 'settings'), 'Settings');
  assert.equal(translate('en', 'fishCount', { count: 72 }), '72 fish');
  assert.equal(translate('ko', 'fishCount', { count: 72 }), '72 마리');
});
