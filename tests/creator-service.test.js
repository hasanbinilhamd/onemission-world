import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCreatorListQuery,
  sanitizeCreatorPayload,
  validateCreatorPayload,
} from '../lib/creator/service.js';

test('buildCreatorListQuery falls back to safe creator sorting when request field is invalid', () => {
  const searchParams = new URLSearchParams({
    sortBy: 'accountCode',
    sortDirection: 'desc',
    page: '2',
    limit: '5',
    search: 'ahmad',
    status: 'Negotiation',
    platform: 'Instagram',
  });

  const result = buildCreatorListQuery(searchParams);

  assert.deepEqual(result.orderBy, { name: 'asc' });
  assert.equal(result.page, 2);
  assert.equal(result.limit, 5);
  assert.equal(result.skip, 5);
  assert.equal(result.take, 5);
  assert.equal(result.sort.usedFallback, true);
  assert.equal(result.filters.search, 'ahmad');
  assert.equal(result.where.status, 'Negotiation');
  assert.equal(result.where.platform, 'Instagram');
  assert.equal(result.where.OR.length, 6);
});

test('sanitizeCreatorPayload keeps only current creator schema fields', () => {
  const result = sanitizeCreatorPayload({
    name: '  Ahmad Fauzan  ',
    username: ' @ahmadfauzan ',
    platform: 'Instagram',
    followers: '250000',
    engagement: '4.8',
    niche: ' Athletic ',
    audienceFit: '130',
    valuesScore: '-5',
    contact: 'ahmad@email.com',
    fee: '12500000',
    status: 'Negotiation',
    notes: 'Priority creator',
    accountCode: '5000',
    accountName: 'Legacy field',
  });

  assert.deepEqual(result, {
    name: 'Ahmad Fauzan',
    username: '@ahmadfauzan',
    platform: 'Instagram',
    followers: 250000,
    engagement: 4.8,
    niche: 'Athletic',
    audienceFit: 100,
    valuesScore: 0,
    contact: 'ahmad@email.com',
    fee: 12500000,
    status: 'Negotiation',
    notes: 'Priority creator',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'accountCode'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'accountName'), false);
});

test('validateCreatorPayload requires current mandatory creator fields', () => {
  assert.equal(validateCreatorPayload({ name: '', platform: 'Instagram' }), 'Creator name is required.');
  assert.equal(validateCreatorPayload({ name: 'Ahmad', platform: '' }), 'Platform is required.');
  assert.equal(validateCreatorPayload({ name: 'Ahmad', platform: 'Instagram' }), null);
});
