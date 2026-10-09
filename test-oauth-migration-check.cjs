// Run with node test-oauth-migration-check.cjs; no Google account or network required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const html = fs.readFileSync(__dirname + '/oauth-migration-check.html', 'utf8');
const code = html.match(/<script id="migration-code">([\s\S]*?)<\/script>/)[1];
const elements = new Map();
let requests = [];
let mismatch = false;
let missing = false;
let expired = false;
let pageCount = 0;
const context = {
  document: {getElementById(id) {if (!elements.has(id)) elements.set(id, {addEventListener() {}}); return elements.get(id);}},
  window: {}, URLSearchParams, TextEncoder, Uint8Array, crypto: webcrypto, AbortSignal,
  fetch: async (url, options) => {
    requests.push({url, options});
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    assert.match(options.headers.Authorization, /^Bearer /);
    assert.equal(new URL(url).origin, 'https://www.googleapis.com');
    assert.ok(!new URL(url).search.includes('token'));
    if (expired) return {ok: false, status: 401};
    const body = url.includes('userinfo') ? {id: mismatch ? 'other' : 'same', email: 'test@example.com'} :
      url.includes('alt=media') ? '{"profiles":[{"completed":3}],"settings":{"mode":"practice"}}' :
      missing ? {files: []} : {files: [{id: 'saved-' + (++pageCount), name: 'factflow_data.json'}], ...(pageCount === 1 ? {nextPageToken: 'second-page'} : {})};
    return {ok: true, json: async () => body, text: async () => body};
  }
};
vm.createContext(context);
vm.runInContext(code, context);
async function check() {
  const original = await context.readSnapshot('test-token');
  assert.equal(original.files.length, 2, 'all matching files and pages must be preserved');
  assert.match(original.files[0].sha256, /^[a-f0-9]{64}$/);
  assert.match(original.files[0].text, /settings/);
  assert.match(context.compareSnapshots(original, original), /identical contents/);
  const wrongAccount = {...original, user: {id: 'other'}};
  assert.match(context.compareSnapshots(original, wrongAccount), /Different Google accounts/);
  assert.match(context.compareSnapshots(original, {...original, files: []}), /migration is required/);
  const changed = {...original, files: original.files.map(file => ({...file, sha256: 'changed'}))};
  assert.match(context.compareSnapshots(original, changed), /contents changed/);
  assert.match(context.compareSnapshots({...original, files: []}, original), /no baseline/);
  missing = true;
  assert.equal((await context.readSnapshot('test-token')).files.length, 0);
  mismatch = true;
  const beforeMismatch = requests.length;
  await assert.rejects(context.readSnapshot('test-token', 'same'), /no progress files were read/);
  assert.equal(requests.length, beforeMismatch + 1, 'a wrong account must be rejected before Drive is read');
  expired = true;
  await assert.rejects(context.readSnapshot('expired-token'), /HTTP 401/);
  assert.ok(requests.length > 0);
  console.log('Migration check tests passed: account mismatch, missing/changed progress, pagination, complete raw backup, failed reads, GET-only requests.');
}
check().catch(error => {console.error(error); process.exitCode = 1;});
