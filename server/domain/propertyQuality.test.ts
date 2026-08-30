import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPropertyQuality } from './propertyQuality.ts';

test('quality score is deterministic and recommendations do not replace publication validation', () => {
  const draft = { editorial: { title: 'Apartamento amplo em Copacabana', description: 'x'.repeat(300) }, media: { orderedPhotoIds: Array.from({ length: 10 }, (_, i) => `photo-${i}`), coverPhotoId: 'photo-0' }, classification: { operations: ['sale'] }, pricing: { sale: 500000, condominium: 1000, iptu: 100 }, privateAddress: { postalCode: '22000-000', state: 'RJ', city: 'Rio de Janeiro', district: 'Copacabana', street: 'Rua A', number: '10' }, publicLocation: { label: 'Copacabana, Rio de Janeiro - RJ', precision: 'approximate' } };
  const first = assessPropertyQuality(draft);
  const second = assessPropertyQuality(draft);
  assert.deepEqual(first, second);
  assert.equal(first.score, 95);
  assert.equal(first.publishable, false);
  assert.ok(first.blockingIssues.length > 0);
  assert.ok(first.recommendations.some((entry) => entry.includes('SEO')));
});
