const { createClient } = require('@supabase/supabase-js');

// No hardcoded fallback project/key: if these env vars are absent the app
// runs on the local JSON fallback (see jsonStore.js) instead of silently
// pointing at a baked-in Supabase project.
function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || '').trim();
}

function getSupabaseKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
}

function isSupabaseConfigured() {
  return !!(getSupabaseUrl() && getSupabaseKey());
}

let cachedClient = null;
let cachedKeySignature = null;

function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  const signature = `${url}::${key}`;

  if (cachedClient && cachedKeySignature === signature) return cachedClient;

  try {
    cachedClient = createClient(url, key);
    cachedKeySignature = signature;
    return cachedClient;
  } catch (e) {
    console.error('Failed to create Supabase client:', e.message);
    cachedClient = null;
    cachedKeySignature = null;
    return null;
  }
}

module.exports = { getSupabaseClient, isSupabaseConfigured, getSupabaseUrl, getSupabaseKey };
