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
  await checkCopy();
  console.log('Migration tests passed: account mismatch, missing/changed progress, pagination, complete raw backup, GET-only checks, guarded copy/read-back, no overwrites, retry without duplicates.');
}
async function checkCopy() {
  const baselineText = '{"profiles":[{"completed":3,"history":[1,2,3]}],"settings":{"mode":"practice"},"version":2}';
  let sourceText = baselineText;
  let destination = [];
  let creates = 0;
  let uncertainWrite = false;
  let wrongNewAccount = false;
  const copyElements = new Map();
  const copyContext = {
    document: {
      getElementById(id) {
        if (!copyElements.has(id)) copyElements.set(id, {listeners: {}, addEventListener(event, fn) {this.listeners[event] = fn;}});
        return copyElements.get(id);
      },
      createElement() {return {click() {}};}
    },
    window: {google: {accounts: {oauth2: {
      hasGrantedAllScopes: () => true,
      initTokenClient(config) {
        assert.equal(config.include_granted_scopes, false);
        assert.ok(!config.scope.includes('/auth/drive '));
        const token = config.client_id.startsWith('220590044784-') ? 'old-token' : 'new-token';
        return {requestAccessToken: () => config.callback({access_token: token, expires_in: 3600})};
      }
    }}}},
    URL, Blob, URLSearchParams, TextEncoder, Uint8Array, crypto: webcrypto, AbortSignal,
    setTimeout: fn => fn(),
    fetch: async (url, options) => {
      assert.equal(new URL(url).origin, 'https://www.googleapis.com');
      const token = options.headers.Authorization.slice(7);
      const isOld = token === 'old-token';
      let body;
      if (options.method === 'POST') {
        assert.equal(isOld, false, 'the original client must never write');
        assert.equal(destination.length, 0, 'no destination file may be overwritten');
        assert.match(url, /\/upload\/drive\/v3\/files\?uploadType=multipart&fields=id,name$/);
        const boundary = options.headers['Content-Type'].split('boundary=')[1];
        const parts = (await options.body.text()).split('--' + boundary);
        const metadata = JSON.parse(parts[1].split('\r\n\r\n')[1].trim());
        assert.deepEqual(metadata.parents, ['appDataFolder']);
        assert.equal(metadata.name, 'factflow_data.json');
        assert.equal(metadata.mimeType, 'application/json');
        const transferredText = parts[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').slice(0, -2);
        assert.equal(transferredText, baselineText, 'all raw progress, history and settings must be copied');
        creates++;
        destination = [{id: 'separate-new-id', name: metadata.name, text: transferredText}];
        if (uncertainWrite) return {ok: false, status: 500};
        body = {id: destination[0].id};
      } else {
        assert.equal(options.method, 'GET', 'no update or deletion is allowed');
        if (url.includes('userinfo')) body = {id: !isOld && wrongNewAccount ? 'another-account' : 'same-account', email: 'test@example.com'};
        else if (url.includes('alt=media')) body = isOld ? sourceText : destination[0].text;
        else {
          assert.equal(new URL(url).searchParams.get('spaces'), 'appDataFolder');
          body = {files: isOld ? [{id: 'original-id', name: 'factflow_data.json'}] : destination.map(({id, name}) => ({id, name}))};
        }
      }
      return {ok: true, json: async () => body, text: async () => body};
    }
  };
  vm.createContext(copyContext);
  vm.runInContext(code, copyContext);
  await copyContext.run('old');
  await copyContext.run('new');
  await copyContext.copyOriginal();
  assert.match(copyElements.get('status').textContent, /download the original backup first/);
  assert.equal(creates, 0);
  copyElements.get('backup').listeners.click();
  await copyContext.copyOriginal();
  assert.match(copyElements.get('status').textContent, /Copy verified/);
  assert.equal(creates, 1);
  assert.deepEqual(JSON.parse(destination[0].text), JSON.parse(baselineText));
  await copyContext.copyOriginal();
  assert.match(copyElements.get('status').textContent, /identical copy already exists/);
  assert.equal(creates, 1);
  sourceText = '{"profiles":[{"completed":4}]}';
  await copyContext.copyOriginal();
  assert.match(copyElements.get('status').textContent, /changed after the backup/);
  assert.equal(creates, 1);
  sourceText = baselineText;
  destination[0].text = '{"profiles":[{"completed":9}]}';
  await copyContext.copyOriginal();
  assert.match(copyElements.get('status').textContent, /different progress/);
  assert.equal(creates, 1);
  destination = [];
  wrongNewAccount = true;
  await copyContext.copyOriginal();
  assert.match(copyElements.get('status').textContent, /Different Google account/);
  assert.equal(creates, 1);
  wrongNewAccount = false;
  uncertainWrite = true;
  await copyContext.copyOriginal();
  assert.match(copyElements.get('status').textContent, /did not confirm the copy/);
  assert.equal(creates, 2);
  uncertainWrite = false;
  await copyContext.copyOriginal();
  assert.match(copyElements.get('status').textContent, /identical copy already exists/);
  assert.equal(creates, 2, 'an uncertain successful write must not produce a duplicate on retry');
}
check().catch(error => {console.error(error); process.exitCode = 1;});
