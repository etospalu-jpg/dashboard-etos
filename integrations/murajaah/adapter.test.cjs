'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalize, fetchReports } = require('./adapter.cjs');
test('accepts wrapped reports', () => assert.equal(normalize({ data: { reports: [{ id: '1' }] } }).length, 1));
test('rejects unknown schema', () => assert.throws(() => normalize({ message: 'ok' }), /Unrecognized/));
test('rejects invalid entries', () => assert.throws(() => normalize([{ id: '1' }, null]), /Invalid record/));
test('reads JSON without credentials', async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.authorization, undefined);
    return { ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ reports: [{ id: '1' }] }) };
  };
  const result = await fetchReports({ fetchImpl });
  assert.equal(result.records.length, 1);
});
test('rejects upstream errors', async () => {
  await assert.rejects(fetchReports({ fetchImpl: async () => ({ ok: false, status: 401 }) }), /401/);
});
