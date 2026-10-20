'use strict';
const SOURCE_URL = 'https://panpejzadufainlnoocw.supabase.co/functions/v1/etos23-report';
const MAX_BYTES = 2_000_000;
function normalize(payload) {
  const rows = Array.isArray(payload) ? payload : [payload?.reports, payload?.data?.reports, payload?.data, payload?.items, payload?.results].find(Array.isArray);
  if (!rows) throw new Error('Unrecognized Murajaah response shape; no records imported');
  return rows.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid record at index ' + index);
    return { sourceIndex: index, raw: record };
  });
}
async function fetchReports({ token, timeoutMs = 12000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    const response = await fetchImpl(SOURCE_URL, { method: 'GET', headers, signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error('Murajaah HTTP ' + response.status);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('json')) throw new Error('Murajaah did not return JSON');
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) throw new Error('Murajaah response too large');
    const payload = JSON.parse(body);
    return { records: normalize(payload), fetchedAt: new Date().toISOString(), source: SOURCE_URL };
  } finally { clearTimeout(timer); }
}
module.exports = { SOURCE_URL, fetchReports, normalize };
