const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://oepvuawnzsvzhuibdlxq.supabase.co';
const DEFAULT_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lcHZ1YXduenN2emh1aWJkbHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MjM2NTksImV4cCI6MjEwMjk5OTY1OX0.Sxu7ISHqH-wLf1dGEEgXUsQ4KIMSkgmIlLsZuYatkrQ';

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
}

function getSupabaseKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON).trim();
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
