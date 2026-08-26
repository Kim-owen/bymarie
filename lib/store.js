const { getSupabaseClient, isSupabaseConfigured } = require('./supabaseClient');
const { readDB, writeDB } = require('./jsonStore');

class DbError extends Error {
  constructor(message, table, cause) {
    super(message);
    this.name = 'DbError';
    this.code = 'DB_ERROR';
    this.table = table;
    this.cause = cause;
  }
}

const warnedFallback = new Set();
function warnFallbackOnce(table) {
  if (warnedFallback.has(table)) return;
  warnedFallback.add(table);
  console.warn(`[local-fallback] SUPABASE not configured -- using local JSON file for "${table}"`);
}

// Supabase is the source of truth whenever it's configured: every op reads or
// writes it directly and throws a DbError on failure (callers/asyncHandler
// turn that into a real 500 instead of a false-success). Only when Supabase
// isn't configured at all does this fall back to the local JSON file, for
// local development -- never as a silent parallel/primary store otherwise.
function createCollection(table, { idField = 'id', jsonKey } = {}) {
  jsonKey = jsonKey || table;

  async function list() {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from(table).select('*');
      if (error) throw new DbError(`Failed to list "${table}": ${error.message}`, table, error);
      return data || [];
    }
    warnFallbackOnce(table);
    const db = readDB();
    return db[jsonKey] || [];
  }

  async function get(id) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from(table).select('*').eq(idField, id).maybeSingle();
      if (error) throw new DbError(`Failed to read "${table}" ${id}: ${error.message}`, table, error);
      return data || null;
    }
    warnFallbackOnce(table);
    const db = readDB();
    return (db[jsonKey] || []).find(r => r[idField] === id) || null;
  }

  async function insert(record) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from(table).insert([record]).select();
      if (error) throw new DbError(`Failed to create "${table}": ${error.message}`, table, error);
      return (data && data[0]) || record;
    }
    warnFallbackOnce(table);
    const db = readDB();
    if (!db[jsonKey]) db[jsonKey] = [];
    db[jsonKey].unshift(record);
    writeDB(db);
    return record;
  }

  async function upsert(record, { conflict } = {}) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const opts = { onConflict: conflict || idField };
      const { data, error } = await client.from(table).upsert([record], opts).select();
      if (error) throw new DbError(`Failed to save "${table}": ${error.message}`, table, error);
      return (data && data[0]) || record;
    }
    warnFallbackOnce(table);
    const db = readDB();
    if (!db[jsonKey]) db[jsonKey] = [];
    const matchField = conflict || idField;
    const idx = db[jsonKey].findIndex(r => r[matchField] === record[matchField]);
    if (idx === -1) db[jsonKey].unshift(record);
    else db[jsonKey][idx] = { ...db[jsonKey][idx], ...record };
    writeDB(db);
    return record;
  }

  async function update(id, patch) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from(table).update(patch).eq(idField, id).select();
      if (error) throw new DbError(`Failed to update "${table}" ${id}: ${error.message}`, table, error);
      return (data && data[0]) || null;
    }
    warnFallbackOnce(table);
    const db = readDB();
    const arr = db[jsonKey] || [];
    const idx = arr.findIndex(r => r[idField] === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...patch };
    writeDB(db);
    return arr[idx];
  }

  async function remove(id) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { error } = await client.from(table).delete().eq(idField, id);
      if (error) throw new DbError(`Failed to delete "${table}" ${id}: ${error.message}`, table, error);
      return true;
    }
    warnFallbackOnce(table);
    const db = readDB();
    db[jsonKey] = (db[jsonKey] || []).filter(r => r[idField] !== id);
    writeDB(db);
    return true;
  }

  return { list, get, insert, upsert, update, remove };
}

// Singleton-row collections (currently just site_settings: a single row id=1).
function createSingleton(table, { id = 1 } = {}) {
  async function get() {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw new DbError(`Failed to read "${table}": ${error.message}`, table, error);
      return data || null;
    }
    warnFallbackOnce(table);
    const db = readDB();
    return db[table] || null;
  }

  async function upsert(patch) {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from(table).upsert({ ...patch, id }).select();
      if (error) throw new DbError(`Failed to save "${table}": ${error.message}`, table, error);
      return (data && data[0]) || patch;
    }
    warnFallbackOnce(table);
    const db = readDB();
    db[table] = { ...(db[table] || {}), ...patch };
    writeDB(db);
    return db[table];
  }

  return { get, upsert };
}

module.exports = { createCollection, createSingleton, DbError, isSupabaseConfigured };
