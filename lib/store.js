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
    let cloudRecords = [];
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from(table).select('*');
        if (!error && data) {
          cloudRecords = data;
        }
      } catch (e) {}
    }
    const db = readDB();
    const localRecords = db[jsonKey] || [];
    const mergedMap = new Map();
    [...cloudRecords, ...localRecords].forEach(r => {
      if (r && r[idField]) mergedMap.set(String(r[idField]), r);
    });
    return Array.from(mergedMap.values());
  }

  async function get(id) {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from(table).select('*').eq(idField, id).maybeSingle();
        if (!error && data) return data;
      } catch (e) {}
    }
    const db = readDB();
    return (db[jsonKey] || []).find(r => String(r[idField]) === String(id)) || null;
  }

  async function findOne(field, value) {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.from(table).select('*').eq(field, value).maybeSingle();
        if (!error && data) return data;
      } catch (e) {}
    }
    const db = readDB();
    return (db[jsonKey] || []).find(r => r[field] === value) || null;
  }

function sanitizeRecordForSupabase(table, record) {
  if (!record || typeof record !== 'object') return record;
  const clean = { ...record };
  delete clean.adminCreated;
  delete clean._lastStock;
  delete clean.tempId;
  return clean;
}

  async function insert(record) {
    // Always mirror to local DB so disk state is preserved
    const db = readDB();
    if (!db[jsonKey]) db[jsonKey] = [];
    db[jsonKey].unshift(record);
    writeDB(db);

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const cleanRecord = sanitizeRecordForSupabase(table, record);
        const { data, error } = await client.from(table).insert([cleanRecord]).select();
        if (error) console.warn(`Supabase insert error on "${table}":`, error.message);
        if (!error && data && data[0]) return data[0];
      } catch (e) {
        console.warn(`Supabase insert fallback for "${table}":`, e.message);
      }
    }
    return record;
  }

  async function upsert(record, { conflict } = {}) {
    // Always mirror to local DB so disk state is preserved
    const db = readDB();
    if (!db[jsonKey]) db[jsonKey] = [];
    const matchField = conflict || idField;
    const idx = db[jsonKey].findIndex(r => String(r[matchField]) === String(record[matchField]));
    if (idx === -1) db[jsonKey].unshift(record);
    else db[jsonKey][idx] = { ...db[jsonKey][idx], ...record };
    writeDB(db);

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const opts = { onConflict: conflict || idField };
        const cleanRecord = sanitizeRecordForSupabase(table, record);
        const { data, error } = await client.from(table).upsert([cleanRecord], opts).select();
        if (error) console.warn(`Supabase upsert error on "${table}":`, error.message);
        if (!error && data && data[0]) return data[0];
      } catch (e) {
        console.warn(`Supabase upsert fallback for "${table}":`, e.message);
      }
    }
    return record;
  }

  async function update(id, patch) {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        const cleanPatch = sanitizeRecordForSupabase(table, patch);
        const { data, error } = await client.from(table).update(cleanPatch).eq(idField, id).select();
        if (!error && data && data[0]) return data[0];
      } catch (e) {
        console.warn(`Supabase update error on "${table}":`, e.message);
      }
    }
    warnFallbackOnce(table);
    const db = readDB();
    const arr = db[jsonKey] || [];
    const idx = arr.findIndex(r => String(r[idField]) === String(id));
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...patch };
    writeDB(db);
    return arr[idx];
  }

  async function remove(id) {
    const db = readDB();
    if (db[jsonKey]) {
      db[jsonKey] = db[jsonKey].filter(r => String(r[idField]) !== String(id));
      writeDB(db);
    }

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        await client.from(table).delete().eq(idField, id);
      } catch (e) {
        console.warn(`Supabase delete error on "${table}" ${id}:`, e.message);
      }
    }
    return true;
  }

  return { list, get, findOne, insert, upsert, update, remove };
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
