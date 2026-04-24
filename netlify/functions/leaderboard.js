const { getStore } = require('@netlify/blobs');

const ALLOWED_ORIGIN = 'https://2026-wcbracket-bpt.netlify.app';

const headers = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const store = getStore('leaderboard');

  // GET — return all entries + phase2 flag
  if (event.httpMethod === 'GET') {
    try {
      const raw = await store.get('data');
      const data = raw ? JSON.parse(raw) : { entries: [], phase2Unlocked: false };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    } catch (e) {
      return { statusCode: 200, headers, body: JSON.stringify({ entries: [], phase2Unlocked: false }) };
    }
  }

  // POST — update entries or phase2 flag
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const raw = await store.get('data');
      const current = raw ? JSON.parse(raw) : { entries: [], phase2Unlocked: false };

      // Update phase2 flag if provided
      if (typeof body.phase2Unlocked === 'boolean') {
        current.phase2Unlocked = body.phase2Unlocked;
      }

      // Upsert entry if provided
      if (body.entry) {
        const idx = current.entries.findIndex(e => e.ParticipantName === body.entry.ParticipantName);
        if (idx >= 0) current.entries[idx] = body.entry;
        else current.entries.push(body.entry);
      }

      await store.set('data', JSON.stringify(current));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      console.error('POST error:', e);
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
