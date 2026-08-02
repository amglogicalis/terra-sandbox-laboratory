// ═══════════════════════════════════════════════════════════════════════════
// BALLOM v1.0.0 — Full Integration Test Suite
// Simulates a complete real user flow across all 6 modules
// Using Terra Sandbox Laboratory as the test infrastructure
// ═══════════════════════════════════════════════════════════════════════════

import { Ballom, ScentKeyEngine, GitHubVaultClient } from '../ballom/Ballom/packages/ballom-sdk/dist/index.js';

const TOKEN = process.env.GITHUB_TOKEN || '';
const STORAGE_REPO = '.ballom-storage';

// ─── Colours ─────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',  bold:   '\x1b[1m',  dim:    '\x1b[2m',
  red:    '\x1b[31m', green:  '\x1b[32m', yellow: '\x1b[33m',
  cyan:   '\x1b[36m', purple: '\x1b[35m', blue:   '\x1b[34m',
};

let passed = 0;
let failed = 0;
const results = [];

function title(msg) {
  console.log(`\n${c.bold}${c.purple}━━━ ${msg} ━━━${c.reset}`);
}

async function test(name, fn) {
  try {
    const t0 = Date.now();
    await fn();
    const ms = Date.now() - t0;
    console.log(`  ${c.green}✔${c.reset} ${name} ${c.dim}(${ms}ms)${c.reset}`);
    passed++;
    results.push({ name, status: 'PASS', ms });
  } catch (err) {
    console.log(`  ${c.red}✘${c.reset} ${name}`);
    console.log(`    ${c.red}${err.message}${c.reset}`);
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// ─── Main Test Suite ─────────────────────────────────────────

async function runTests() {
  console.log(`\n${c.bold}${c.purple}🎭 BALLOM Integration Test Suite v1.0.0${c.reset}`);
  console.log(`${c.dim}Storage repo: ${STORAGE_REPO} | Token: ${TOKEN.slice(0,16)}...${c.reset}\n`);

  // ─────────────────────────────────────────────────────────
  title('0. SDK Init & GitHub Connection');
  // ─────────────────────────────────────────────────────────

  let ballom;

  await test('Ballom() constructor accepts config', async () => {
    ballom = new Ballom({ githubToken: TOKEN, storageRepo: STORAGE_REPO, cdnRepo: 'ballom-cdn' });
    assert(ballom instanceof Ballom, 'should be Ballom instance');
  });

  await test('ballom.init() — create .ballom-storage repo & load state', async () => {
    await ballom.init();
    // If no error thrown, storage repo is ready
    assert(true, 'init completed');
  });

  await test('Reset state to clean sandbox', async () => {
    const vault = new GitHubVaultClient(TOKEN, STORAGE_REPO, 'ballom-cdn');
    await vault.saveState({
      version: '1.0.0',
      domains: {},
      phantoms: {},
      routes: {},
      larvae: {},
      endpoints: {},
      scentKeys: {},
      auditLog: []
    }, 'Reset test state for clean integration run');
    // Re-initialize to load the fresh empty state
    await ballom.init();
    assert(true, 'state reset complete');
  });

  // ─────────────────────────────────────────────────────────
  title('1. 🎭 Feromask — Phantom URL Cloaking');
  // ─────────────────────────────────────────────────────────

  let phantomId;

  await test('createPhantom() — iframe mode for own GitHub Pages content', async () => {
    const phantom = await ballom.createPhantom(
      'https://amglogicalis.github.io/terra-sandbox-laboratory/',
      'miapp.com',
      'iframe',
      { title: 'Test Phantom', description: 'Terra BALLOM integration test phantom' }
    );
    assert(phantom.phantomId, 'should have phantomId');
    assert(phantom.mode === 'iframe', 'mode should be iframe');
    assert(phantom.targetUrl === 'https://amglogicalis.github.io/terra-sandbox-laboratory/', 'target URL mismatch');
    assert(phantom.maskedDomain === 'miapp.com', 'masked domain mismatch');
    assert(phantom.active === true, 'should be active');
    phantomId = phantom.phantomId;
    console.log(`    ${c.dim}→ ID: ${phantomId}${c.reset}`);
  });

  await test('createPhantom() — morph mode for external URL', async () => {
    const phantom = await ballom.createPhantom(
      'https://github.com/amglogicalis',
      'profile.miapp.com',
      'morph',
      { title: 'GitHub Profile', morphUrl: 'https://ballom-morph.vercel.app' }
    );
    assert(phantom.mode === 'morph', 'mode should be morph');
    assert(phantom.morphUrl, 'should have morphUrl');
    console.log(`    ${c.dim}→ ID: ${phantom.phantomId} (morph)${c.reset}`);
  });

  await test('listPhantoms() — returns both created phantoms', async () => {
    const phantoms = await ballom.listPhantoms();
    assert(phantoms.length >= 2, `expected ≥2 phantoms, got ${phantoms.length}`);
  });

  await test('updatePhantom() — change title of existing phantom', async () => {
    const updated = await ballom.updatePhantom(phantomId, { title: 'Updated Phantom Title' });
    assert(updated.title === 'Updated Phantom Title', 'title not updated');
  });

  await test('deletePhantom() — remove morph phantom', async () => {
    const phantoms = await ballom.listPhantoms();
    const morphPhantom = phantoms.find(p => p.mode === 'morph');
    if (morphPhantom) {
      await ballom.deletePhantom(morphPhantom.phantomId);
      const after = await ballom.listPhantoms();
      assert(!after.find(p => p.phantomId === morphPhantom.phantomId), 'morph phantom should be deleted');
    }
  });

  // ─────────────────────────────────────────────────────────
  title('2. 🔗 MyrmiLink — Custom Domain Binding');
  // ─────────────────────────────────────────────────────────

  let domainId;

  await test('bindDomain() — github-pages target', async () => {
    const record = await ballom.bindDomain(
      'miapp.com',
      'github-pages',
      { targetRepo: 'amglogicalis/terra-sandbox-laboratory' }
    );
    assert(record.domainId, 'should have domainId');
    assert(record.domain === 'miapp.com', 'domain mismatch');
    assert(record.cnameValue === 'amglogicalis.github.io', 'CNAME value mismatch');
    assert(record.verified === false, 'should start as unverified');
    domainId = record.domainId;
    console.log(`    ${c.dim}→ ID: ${domainId} | CNAME: ${record.cnameValue}${c.reset}`);
  });

  await test('bindDomain() — custom target', async () => {
    const record = await ballom.bindDomain(
      'api.miapp.com',
      'custom',
      { targetUrl: 'https://my-backend.fly.io' }
    );
    assert(record.cnameValue === 'my-backend.fly.io', `cnameValue mismatch: got ${record.cnameValue}`);
    console.log(`    ${c.dim}→ CNAME: ${record.cnameValue}${c.reset}`);
  });

  await test('bindDomain() — duplicate domain throws', async () => {
    let threw = false;
    try { await ballom.bindDomain('miapp.com', 'github-pages', { targetRepo: 'amglogicalis/other' }); }
    catch { threw = true; }
    assert(threw, 'should throw on duplicate domain');
  });

  await test('getDnsInstructions() — returns correct DNS setup', () => {
    const instructions = ballom.getDnsInstructions(domainId);
    assert(instructions.type === 'CNAME', 'type should be CNAME');
    assert(instructions.value === 'amglogicalis.github.io', `value mismatch: ${instructions.value}`);
    assert(instructions.notes.length > 0, 'should have notes');
    console.log(`    ${c.dim}→ ${instructions.type} ${instructions.name} → ${instructions.value}${c.reset}`);
  });

  await test('verifyDomain() — check DNS propagation via DoH', async () => {
    const result = await ballom.verifyDomain(domainId);
    // miapp.com is not real — we expect verified: false but no crash
    assert(typeof result.verified === 'boolean', 'should return boolean verified');
    assert(typeof result.message === 'string', 'should return message');
    console.log(`    ${c.dim}→ verified: ${result.verified} | ${result.message}${c.reset}`);
  });

  await test('listDomains() — returns bound domains', async () => {
    const domains = await ballom.listDomains();
    assert(domains.length >= 2, `expected ≥2 domains, got ${domains.length}`);
  });

  await test('unbindDomain() — removes api.miapp.com', async () => {
    const domains = await ballom.listDomains();
    const apiDomain = domains.find(d => d.domain === 'api.miapp.com');
    if (apiDomain) {
      await ballom.unbindDomain(apiDomain.domainId);
      const after = await ballom.listDomains();
      assert(!after.find(d => d.domain === 'api.miapp.com'), 'domain should be removed');
    }
  });

  // ─────────────────────────────────────────────────────────
  title('3. 🔌 ChitinGate — API Gateway & Endpoints');
  // ─────────────────────────────────────────────────────────

  let endpointId;

  await test('createEndpoint() — static mode with JSON data', async () => {
    const ep = await ballom.createEndpoint('/api/v1/products', 'static', {
      methods: ['GET'],
      staticData: {
        products: [
          { id: 1, name: 'Widget Pro', price: 29.99 },
          { id: 2, name: 'Gadget Plus', price: 49.99 }
        ],
        total: 2
      },
      description: 'Product catalogue endpoint'
    });
    assert(ep.endpointId, 'should have endpointId');
    assert(ep.path === '/api/v1/products', 'path mismatch');
    assert(ep.mode === 'static', 'mode should be static');
    assert(ep.active === true, 'should be active');
    endpointId = ep.endpointId;
    console.log(`    ${c.dim}→ ID: ${endpointId} | /api/v1/products${c.reset}`);
  });

  await test('createEndpoint() — actions mode', async () => {
    const ep = await ballom.createEndpoint('/api/v1/process', 'actions', {
      methods: ['POST'],
      actionsWorkflow: 'process-request',
      description: 'Async processing endpoint via GitHub Actions'
    });
    assert(ep.mode === 'actions', 'mode should be actions');
    assert(ep.actionsWorkflow === 'process-request', 'workflow mismatch');
  });

  await test('createEndpoint() — morph mode', async () => {
    const ep = await ballom.createEndpoint('/api/v1/realtime', 'morph', {
      methods: ['GET', 'POST'],
      morphUrl: 'https://my-morph.vercel.app/api/realtime',
      description: 'Real-time endpoint via WEBBL Morph'
    });
    assert(ep.mode === 'morph', 'mode should be morph');
  });

  await test('createEndpoint() — duplicate path throws', async () => {
    let threw = false;
    try { await ballom.createEndpoint('/api/v1/products', 'static', { staticData: {} }); }
    catch { threw = true; }
    assert(threw, 'duplicate path should throw');
  });

  await test('updateEndpointData() — update static endpoint JSON', async () => {
    const newData = { products: [{ id: 3, name: 'SuperWidget', price: 99.99 }], total: 1 };
    const updated = await ballom.updateEndpointData(endpointId, newData);
    assert(updated.staticData.total === 1, 'data not updated');
  });

  await test('listEndpoints() — returns all 3 endpoints', async () => {
    const eps = await ballom.listEndpoints();
    assert(eps.length >= 3, `expected ≥3 endpoints, got ${eps.length}`);
  });

  await test('deleteEndpoint() — remove morph endpoint', async () => {
    const eps = await ballom.listEndpoints();
    const morphEp = eps.find(e => e.mode === 'morph');
    if (morphEp) {
      await ballom.deleteEndpoint(morphEp.endpointId);
      const after = await ballom.listEndpoints();
      assert(!after.find(e => e.endpointId === morphEp.endpointId), 'morph endpoint should be deleted');
    }
  });

  // ─────────────────────────────────────────────────────────
  title('4. 🥚 Larvae — Dynamic Aliases & Short Links');
  // ─────────────────────────────────────────────────────────

  let createdSlug;

  await test('createAlias() — auto-generated slug', async () => {
    const result = await ballom.createAlias('https://terra-ecosystem.dev', {
      baseUrl: 'https://miapp.com'
    });
    assert(result.alias.slug, 'should have a slug');
    assert(result.alias.targetUrl === 'https://terra-ecosystem.dev', 'targetUrl mismatch');
    assert(result.alias.clicks === 0, 'clicks should start at 0');
    assert(result.shortUrl.includes(result.alias.slug), 'shortUrl should contain slug');
    createdSlug = result.alias.slug;
    console.log(`    ${c.dim}→ /${createdSlug} → https://terra-ecosystem.dev${c.reset}`);
  });

  await test('createAlias() — custom slug', async () => {
    const result = await ballom.createAlias('https://github.com/amglogicalis', {
      slug: 'gh-profile',
      baseUrl: 'https://miapp.com'
    });
    assert(result.alias.slug === 'gh-profile', 'custom slug mismatch');
    console.log(`    ${c.dim}→ /gh-profile → https://github.com/amglogicalis${c.reset}`);
  });

  await test('createAlias() — duplicate slug throws', async () => {
    let threw = false;
    try { await ballom.createAlias('https://example.com', { slug: 'gh-profile' }); }
    catch { threw = true; }
    assert(threw, 'duplicate slug should throw');
  });

  await test('createAlias() — with expiry date', async () => {
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await ballom.createAlias('https://docs.terra.dev', {
      slug: 'docs-link',
      expiresAt: expires
    });
    assert(result.alias.expiresAt === expires, 'expiresAt mismatch');
  });

  await test('resolveAlias() — resolves slug to target URL', async () => {
    const url = await ballom.resolveAlias('gh-profile');
    assert(url === 'https://github.com/amglogicalis', `resolved URL mismatch: ${url}`);
  });

  await test('listAliases() — returns all created aliases', async () => {
    const aliases = await ballom.listAliases();
    assert(aliases.length >= 3, `expected ≥3 aliases, got ${aliases.length}`);
  });

  await test('deleteAlias() — removes an alias', async () => {
    await ballom.deleteAlias(createdSlug);
    const aliases = await ballom.listAliases();
    assert(!aliases.find(a => a.slug === createdSlug), 'alias should be deleted');
  });

  // ─────────────────────────────────────────────────────────
  title('5. 🐛 PheroPaths — Intelligent Routing Engine');
  // ─────────────────────────────────────────────────────────

  let routeId;

  await test('createRoute() — exact path match', async () => {
    const route = await ballom.createRoute(
      'Home Route',
      { matchType: 'path', pattern: '/' },
      'phantom',
      phantomId,
      { priority: 10 }
    );
    assert(route.routeId, 'should have routeId');
    assert(route.priority === 10, 'priority mismatch');
    routeId = route.routeId;
    console.log(`    ${c.dim}→ ID: ${routeId} | priority: 10${c.reset}`);
  });

  await test('createRoute() — prefix match', async () => {
    const route = await ballom.createRoute(
      'API Route',
      { matchType: 'prefix', pattern: '/api/' },
      'proxy',
      'https://api.miapp.com',
      { priority: 20, fallback: 'https://fallback.miapp.com' }
    );
    assert(route.condition.matchType === 'prefix', 'matchType mismatch');
    assert(route.fallback === 'https://fallback.miapp.com', 'fallback mismatch');
  });

  await test('createRoute() — regex match', async () => {
    const route = await ballom.createRoute(
      'Blog Route',
      { matchType: 'regex', pattern: '^/blog/\\d{4}/.*' },
      'redirect',
      'https://blog.miapp.com',
      { priority: 30 }
    );
    assert(route.condition.matchType === 'regex', 'matchType mismatch');
  });

  await test('evaluateRoute() — matches exact path', async () => {
    const result = await ballom.evaluateRoute('/');
    assert(result.matched === true, 'should match /');
    if (result.matched) {
      assert(result.route.name === 'Home Route', `expected 'Home Route', got '${result.route.name}'`);
    }
  });

  await test('evaluateRoute() — matches prefix /api/users', async () => {
    const result = await ballom.evaluateRoute('/api/users');
    assert(result.matched === true, 'should match /api/users via prefix');
    if (result.matched) {
      assert(result.route.name === 'API Route', `expected 'API Route', got '${result.route.name}'`);
    }
  });

  await test('evaluateRoute() — matches regex /blog/2024/hello-world', async () => {
    const result = await ballom.evaluateRoute('/blog/2024/hello-world');
    assert(result.matched === true, 'should match blog route');
    if (result.matched) {
      assert(result.route.name === 'Blog Route', `expected 'Blog Route'`);
    }
  });

  await test('evaluateRoute() — no match for unknown path', async () => {
    const result = await ballom.evaluateRoute('/unknown/path/xyz');
    assert(result.matched === false, 'should not match unknown path');
  });

  await test('listRoutes() — returns routes sorted by priority', async () => {
    const routes = await ballom.listRoutes();
    assert(routes.length >= 3, `expected ≥3 routes, got ${routes.length}`);
    for (let i = 1; i < routes.length; i++) {
      assert(routes[i].priority >= routes[i - 1].priority, 'routes should be sorted by priority asc');
    }
  });

  await test('updateRoute() — change priority', async () => {
    const updated = await ballom.updateRoute(routeId, { priority: 5 });
    assert(updated.priority === 5, 'priority not updated');
  });

  await test('deleteRoute() — removes blog route', async () => {
    const routes = await ballom.listRoutes();
    const blogRoute = routes.find(r => r.name === 'Blog Route');
    if (blogRoute) {
      await ballom.deleteRoute(blogRoute.routeId);
      const after = await ballom.listRoutes();
      assert(!after.find(r => r.name === 'Blog Route'), 'blog route should be deleted');
    }
  });

  // ─────────────────────────────────────────────────────────
  title('6. 🔑 ScentKey — API Key Management');
  // ─────────────────────────────────────────────────────────

  let keyId;
  let rawKey;

  await test('createScentKey() — live key with scopes', async () => {
    const created = await ballom.createScentKey(
      'Production API Key',
      ['read', 'write', 'gateway:invoke'],
      { env: 'live', description: 'Main production key for Terra app' }
    );
    assert(created.keyId, 'should have keyId');
    assert(created.rawKey.startsWith('sck_live_'), `rawKey format wrong: ${created.rawKey.slice(0, 20)}`);
    assert(created.rawKey.length > 20, 'rawKey too short');
    assert(created.scopes.includes('read'), 'missing read scope');
    assert(created.env === 'live', 'env should be live');
    keyId = created.keyId;
    rawKey = created.rawKey;
    console.log(`    ${c.dim}→ ID: ${keyId} | prefix: ${created.keyPrefix}${c.reset}`);
  });

  await test('createScentKey() — test env key', async () => {
    const created = await ballom.createScentKey(
      'Test Key',
      ['read'],
      { env: 'test' }
    );
    assert(created.rawKey.startsWith('sck_test_'), `rawKey format wrong: ${created.rawKey.slice(0, 20)}`);
    assert(created.env === 'test', 'env should be test');
  });

  await test('createScentKey() — wildcard scope key', async () => {
    const created = await ballom.createScentKey('Admin Key', ['*'], { env: 'live' });
    assert(created.scopes.includes('*'), 'should have wildcard scope');
  });

  await test('validateScentKey() — valid key with correct scopes', async () => {
    const result = await ballom.validateScentKey(rawKey, ['read', 'write']);
    assert(result.valid === true, `key should be valid: ${result.reason}`);
    assert(result.keyId === keyId, 'keyId mismatch');
  });

  await test('validateScentKey() — valid key passes with no required scopes', async () => {
    const result = await ballom.validateScentKey(rawKey, []);
    assert(result.valid === true, 'should be valid with no scope requirement');
  });

  await test('validateScentKey() — fails with wrong required scope', async () => {
    const result = await ballom.validateScentKey(rawKey, ['larvae:create']);
    assert(result.valid === false, 'should fail: key lacks larvae:create scope');
    assert(result.reason?.includes('lacks required scopes'), `unexpected reason: ${result.reason}`);
  });

  await test('validateScentKey() — fails for fake key', async () => {
    const result = await ballom.validateScentKey('sck_live_totally_fake_key_000000');
    assert(result.valid === false, 'fake key should be invalid');
  });

  await test('rotateScentKey() — issues new key, revokes old', async () => {
    const newKey = await ballom.rotateScentKey(keyId);
    assert(newKey.rawKey.startsWith('sck_live_'), 'new key format wrong');
    assert(newKey.keyId !== keyId, 'new key should have different ID');
    // Old key should now be revoked
    const result = await ballom.validateScentKey(rawKey);
    assert(result.valid === false, 'old key should be revoked after rotation');
    rawKey = newKey.rawKey;
    keyId = newKey.keyId;
    console.log(`    ${c.dim}→ Rotated to new ID: ${keyId}${c.reset}`);
  });

  await test('revokeScentKey() — revokes a key', async () => {
    const keys = await ballom.listScentKeys();
    const testKey = keys.find(k => k.env === 'test' && k.active);
    if (testKey) {
      await ballom.revokeScentKey(testKey.keyId);
      const after = await ballom.listScentKeys();
      const revoked = after.find(k => k.keyId === testKey.keyId);
      assert(revoked && !revoked.active, 'key should be revoked (active=false)');
    }
  });

  await test('listScentKeys() — returns all key records (no raw keys)', async () => {
    const keys = await ballom.listScentKeys();
    assert(keys.length >= 3, `expected ≥3 keys, got ${keys.length}`);
    for (const k of keys) {
      assert(!('rawKey' in k), 'raw key should NOT be in list records');
      assert(k.keyHash, 'should have keyHash');
    }
  });

  // ─────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────

  const total = passed + failed;
  console.log(`\n${c.bold}${'═'.repeat(55)}${c.reset}`);
  console.log(`${c.bold}📊 BALLOM Integration Test Results${c.reset}`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`  Total  : ${total}`);
  console.log(`  ${c.green}Passed : ${passed}${c.reset}`);
  if (failed > 0) {
    console.log(`  ${c.red}Failed : ${failed}${c.reset}`);
    console.log(`\n  ${c.red}${c.bold}Failed Tests:${c.reset}`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ${c.red}✘${c.reset} ${r.name}`);
      console.log(`      ${c.dim}${r.error}${c.reset}`);
    });
  } else {
    console.log(`\n  ${c.green}${c.bold}🎉 All tests passed! BALLOM v1.0.0 is ready for production.${c.reset}`);
  }
  console.log(`${'═'.repeat(55)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error(`\n${c.red}Fatal error: ${err.message}${c.reset}`);
  console.error(err.stack);
  process.exit(1);
});
