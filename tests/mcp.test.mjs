// /mcp endpoint unit tests (src/lib/server/mcp.ts): protocol shape, agent-token auth, the $1
// request fee, freeze enforcement, and the crash-safety journal. node:sqlite + real migrations.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp, MCP_REQUEST_FEE_CENTS } from '../src/lib/server/mcp.ts';

function d1Shim(db) {
  const prepare = sql => ({
    bind(...params) { this.params = params; return this; },
    async first() { return db.prepare(sql).get(...(this.params || [])) ?? null; },
    async all() { return { results: db.prepare(sql).all(...(this.params || [])) }; },
    async run() {
      const r = db.prepare(sql).run(...(this.params || []));
      return { meta: { changes: Number(r.changes) } };
    },
  });
  return { prepare };
}

function setup(userId, { frozen = false, identityUnreachable = false } = {}) {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync('migrations/' + file, 'utf8'));
  const data = JSON.stringify({ files: [{ title: 'Quarterly Excuses', type: 'document' }, { title: 'Budget', type: 'sheet' }] });
  db.prepare('INSERT INTO workspaces (owner_key, data, revision, updated_at) VALUES (?, ?, 7, ?)').run(`user:${userId}`, data, '2026-11-03T00:00:00Z');
  const charges = [];
  const chargedKeys = new Map();
  const env = {
    DB: d1Shim(db),
    IDENTITY_INTERNAL_SECRET: 'bsec',
    IDENTITY_ORIGIN: 'http://identity.test',
    BANKING: {
      async charge(input) {
        if (input.idempotencyKey && chargedKeys.get(input.idempotencyKey) === input.amount)
          return { balance: 12345, opened: false, duplicate: true };
        if (input.idempotencyKey) chargedKeys.set(input.idempotencyKey, input.amount);
        charges.push(input);
        return { balance: 12345, opened: false, duplicate: false };
      },
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (identityUnreachable) throw new Error('connection refused');
    if (String(url).endsWith('/api/internal/agent-token')) {
      const token = JSON.parse(init.body).token;
      if (!String(token).startsWith('good-')) return new Response(JSON.stringify({ error: 'unknown_token' }), { status: 404 });
      return new Response(JSON.stringify({ tokenId: 'tok1', tokenName: 'test', userId, email: `${userId}@x.test`, name: 'Ingo' }), { status: 200 });
    }
    return new Response(JSON.stringify({ frozen }), { status: 200 });
  };
  return { db, env, charges, restore: () => { globalThis.fetch = originalFetch; } };
}

const post = (body, headers = {}) => new Request('https://office.southbag.cc/mcp', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const auth = { authorization: 'Bearer good-token-1' };
const key = { 'idempotency-key': 'test-key-0001' };
const journal = db => db.prepare('SELECT * FROM mcp_call').all();

test('initialize needs no auth; GET is 405; notifications are 202', async () => {
  const { env, restore } = setup('u1');
  const res = await handleMcp(post(rpc(1, 'initialize')), env);
  assert.equal((await res.json()).result.serverInfo.name, 'southbag-office');
  assert.equal((await handleMcp(new Request('https://office.southbag.cc/mcp'), env)).status, 405);
  assert.equal((await handleMcp(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), env)).status, 202);
  restore();
});

test('tools/list is authenticated but free', async () => {
  const { env, charges, restore } = setup('u1');
  assert.equal((await handleMcp(post(rpc(1, 'tools/list')), env)).status, 401);
  const res = await handleMcp(post(rpc(2, 'tools/list'), auth), env);
  assert.deepEqual((await res.json()).result.tools.map(t => t.name), ['list_documents', 'get_workspace_summary']);
  assert.equal(charges.length, 0);
  restore();
});

test('list_documents charges $1 and returns titles with a receipt; retry replays', async () => {
  const { db, env, charges, restore } = setup('u1');
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'list_documents', arguments: {} }), { ...auth, ...key }), env);
  const body = await res.json();
  assert.equal(body.result.isError, false);
  assert.deepEqual(body.result.structuredContent.documents.map(d => d.title), ['Quarterly Excuses', 'Budget']);
  assert.equal(body.result.structuredContent.receipt.requestFee.amount, MCP_REQUEST_FEE_CENTS);
  assert.equal(charges[0].idempotencyKey, 'mcp|office|request|u1|test-key-0001');
  assert.equal(journal(db)[0].status, 'done');
  const again = await handleMcp(post(rpc(2, 'tools/call', { name: 'list_documents' }), { ...auth, ...key }), env);
  assert.equal((await again.json()).result.structuredContent.receipt.duplicate, true);
  assert.equal(charges.length, 1);
  restore();
});

test('get_workspace_summary returns counts and revision', async () => {
  const { env, restore } = setup('u1');
  const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'get_workspace_summary' }), { ...auth, ...key }), env);
  const body = await res.json();
  assert.equal(body.result.structuredContent.documents, 2);
  assert.equal(body.result.structuredContent.revision, 7);
  restore();
});

test('missing key refused; key reuse across tools or args is a caller bug', async () => {
  const { env, charges, restore } = setup('u1');
  assert.equal((await (await handleMcp(post(rpc(1, 'tools/call', { name: 'list_documents' }), auth), env)).json()).error.code, -32602);
  await handleMcp(post(rpc(2, 'tools/call', { name: 'list_documents', arguments: {} }), { ...auth, ...key }), env);
  assert.match((await (await handleMcp(post(rpc(3, 'tools/call', { name: 'get_workspace_summary' }), { ...auth, ...key }), env)).json()).error.message, /already used for 'list_documents'/);
  assert.match((await (await handleMcp(post(rpc(4, 'tools/call', { name: 'list_documents', arguments: { x: 1 } }), { ...auth, ...key }), env)).json()).error.message, /different arguments/);
  assert.equal(charges.length, 1);
  restore();
});

test('frozen and unknown both fail closed with no charge and no journal row', async () => {
  for (const opts of [{ frozen: true }, { identityUnreachable: true }]) {
    const { db, env, charges, restore } = setup('u1', opts);
    const res = await handleMcp(post(rpc(1, 'tools/call', { name: 'list_documents' }), { ...auth, ...key }), env);
    assert.ok([200, 503].includes(res.status));
    if (res.status === 200) assert.equal((await res.json()).result.isError, true);
    assert.equal(charges.length, 0);
    assert.equal(journal(db).length, 0);
    restore();
  }
});

test('a pending row is terminal: never re-run, then replays once the original lands', async () => {
  const { db, env, charges, restore } = setup('u1');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('{"arguments":{},"name":"list_documents"}'));
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  db.prepare("INSERT INTO mcp_call (idempotency_key, user_id, tool, args_hash, status, created_at, updated_at) VALUES ('u1|test-key-0001', 'u1', 'list_documents', ?, 'pending', ?, ?)")
    .run(hash, Date.now() - 120000, Date.now() - 120000);
  const retry = await handleMcp(post(rpc(1, 'tools/call', { name: 'list_documents' }), { ...auth, ...key }), env);
  assert.equal((await retry.json()).result.structuredContent.unknownOutcome, true);
  assert.equal(charges.length, 0);
  const stored = { content: [{ type: 'text', text: '2 documents.' }], isError: false, structuredContent: { receipt: { duplicate: false } } };
  db.prepare("UPDATE mcp_call SET status = 'done', response = ?, updated_at = ? WHERE idempotency_key = 'u1|test-key-0001'").run(JSON.stringify(stored), Date.now());
  const replay = await handleMcp(post(rpc(2, 'tools/call', { name: 'list_documents' }), { ...auth, ...key }), env);
  assert.equal((await replay.json()).result.structuredContent.receipt.duplicate, true);
  assert.equal(charges.length, 0);
  restore();
});
