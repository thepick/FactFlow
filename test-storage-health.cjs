'use strict';
// Minimal storage safety net for FactFlow. Loads the real index.html inline
// scripts in a VM (load smoke) and exercises the student-data save/load path,
// unreadable-data fallback, and credential isolation — no browser required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;

function section(file, start, end) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'Missing source section in ' + file + ': ' + start);
  return source.slice(first, last);
}

function context(source, globals) {
  return vm.runInNewContext(source + '\n;globalThis', { ...globals, console });
}

// Load smoke: every inline (non-external, non-module) <script> block must parse.
function loadSmoke(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  let count = 0;
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/type\s*=\s*["'](?:module|application\/)/.test(attrs)) continue;
    new vm.Script(m[2]);
    count++;
  }
  assert.ok(count >= 1, 'No parseable inline scripts in ' + file);
  return count;
}

(async () => {
  const file = 'index.html';
  loadSmoke(file);

  const STORAGE_KEY = 'factflow-progress-';
  const store = {}, session = {};
  const localStorage = {
    getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
  };
  const sessionStorage = {
    getItem: k => Object.prototype.hasOwnProperty.call(session, k) ? session[k] : null,
    setItem: (k, v) => { session[k] = String(v); },
    removeItem: k => { delete session[k]; },
  };
  const base = {
    SHARED_DEVICE_MODE: false, PERF_DEBUG: false, perfCounters: {},
    STORAGE_KEY, STARTING_TABLE: 1, SYNC_TOKEN_SESSION_KEY: 'factflow-google-token-session-gmail-v1',
    syncState: { localSaveCounter: 0, pendingPush: false },
    state: { settings: { speed: 30 } },
    migrateProgress: p => p,
    defaultProgress: () => ({ sessionsCompleted: 0 }),
    cloneJson: v => JSON.parse(JSON.stringify(v)),
    normalizeProgressForSave: p => p,
    copySettings: s => Object.assign({}, s),
    nowIso: () => '2026-01-01T00:00:00.000Z', nowMs: () => 1,
    getUserId: () => 'student-1',
    isGooglePracticeSession: () => false,
    setSyncStatus: () => {}, scheduleCloudSync: () => {},
    safeStorageSet: (storage, k, v) => { try { storage.setItem(k, v); } catch {} },
    localStorage, sessionStorage,
  };

  const progress = { factStats: {}, currentTable: 7, sessionsCompleted: 3, sessionHistory: [], allTimeBestStreak: 0, allTimeBestFpm: 0, dailyQuizCounts: {} };

  // Save/load round-trip on the student-data path.
  const write = context(section(file, 'function writeProgressToStorageNow(', 'function loadProgress('), base);
  write.writeProgressToStorageNow(progress, { skipSync: true });
  const persisted = JSON.parse(store[STORAGE_KEY + 'student-1']);
  assert.ok(persisted, 'writeProgressToStorageNow persisted student progress');
  assert.equal(persisted.sessionsCompleted, 3, 'round-trip preserves sessionsCompleted');
  assert.equal(persisted.currentTable, 7, 'round-trip preserves currentTable');
  assert.ok(persisted.updatedAt && persisted.settings, 'write stamps updatedAt + settings');

  const read = context(section(file, 'function readProgressFromStorage()', 'function writeProgressToStorageNow('), base);
  assert.equal(read.readProgressFromStorage().sessionsCompleted, 3, 'load returns saved progress');

  // Unreadable data falls back to a fresh default instead of throwing.
  store[STORAGE_KEY + 'student-1'] = '{broken json';
  assert.equal(read.readProgressFromStorage().sessionsCompleted, 0, 'corrupt progress falls back to default');

  // Credential isolation: the OAuth token lives in sessionStorage, never localStorage.
  const token = context(section(file, 'function saveTokenSession(', 'function restoreTokenSession('), base);
  token.saveTokenSession({ access_token: 'SECRET', expires_in: 3600 });
  assert.equal(JSON.stringify(store).includes('SECRET'), false, 'token must not reach localStorage');
  assert.equal(JSON.stringify(session).includes('SECRET'), true, 'token persisted to sessionStorage');

  // Recovery copy redacts credentials: stores the student key + progress, no token.
  const recovery = context(section(file, 'function getRecoveryKey(', 'function loadUnsyncedRecoveryCopy('), {
    ...base, UNSYNCED_RECOVERY_KEY: 'factflow-unsynced-recovery-v1',
    getRealGoogleUser: () => ({ email: 'Student@Example.com' }),
    loadProgress: () => progress, round: null,
  });
  assert.equal(recovery.saveUnsyncedRecoveryCopy(), true, 'recovery copy saved');
  const rec = JSON.parse(Object.values(store).find(v => v && v.includes('"studentKey"')));
  assert.equal(rec.studentKey, 'student@example.com');
  assert.equal(JSON.stringify(rec).includes('access_token'), false, 'recovery copy omits credentials');

  console.log('storage-health: load smoke, save/load round-trip, corrupt-data fallback, token + recovery redaction passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
