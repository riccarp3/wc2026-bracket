const { getStore } = require('@netlify/blobs');

const ALLOWED_ORIGIN = 'https://2026-wcbracket-bpt.netlify.app';

const headers = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function getStoreInstance() {
  return getStore({
    name: 'leaderboard',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN,
  });
}

async function getData(store, key, fallback) {
  try {
    const raw = await store.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) {
    return fallback;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const store = getStoreInstance();

  // GET — return leaderboard + admin results
  if (event.httpMethod === 'GET') {
    try {
      const [leaderboard, adminResults] = await Promise.all([
        getData(store, 'leaderboard', { entries: [], phase2Unlocked: false }),
        getData(store, 'adminResults', { groupResults: {}, knockoutResults: {}, r32Assignments: {}, thirdPlaceQualifiers: [], qualifierResults: {}, bonusResults: {} }),
      ]);
      return { statusCode: 200, headers, body: JSON.stringify({ ...leaderboard, adminResults }) };
    } catch (e) {
      console.error('GET error:', e);
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // POST — update leaderboard entries, phase2 flag, or admin results
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');

      // Admin results update
      if (body.adminResults) {
        const current = await getData(store, 'adminResults', {
          groupResults: {}, knockoutResults: {}, r32Assignments: {},
          thirdPlaceQualifiers: [], qualifierResults: {}, bonusResults: {}
        });
        const updated = { ...current, ...body.adminResults };
        await store.set('adminResults', JSON.stringify(updated));
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      // Leaderboard update
      const current = await getData(store, 'leaderboard', { entries: [], phase2Unlocked: false });

      if (typeof body.phase2Unlocked === 'boolean') {
        current.phase2Unlocked = body.phase2Unlocked;
      }
      if (body.entry) {
        const idx = current.entries.findIndex(e => e.ParticipantName === body.entry.ParticipantName);
        if (idx >= 0) current.entries[idx] = body.entry;
        else current.entries.push(body.entry);
      }
      if (body.entries) {
        current.entries = body.entries;
      }

      await store.set('leaderboard', JSON.stringify(current));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      console.error('POST error:', e);
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
