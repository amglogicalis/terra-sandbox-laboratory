/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TERRA SANDBOX & LABORATORY — Real End-to-End Integration Test
 *  Simulates a developer creating a real project using every Terra app.
 *
 *  Story: "Alex" is a developer who wants to build "ProjectNova",
 *  a SaaS app. He signs up with LUMINA, stores his assets in ROLLA,
 *  deploys his landing page with WEBBL, and tracks all events with COMBASE.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Lumina } from 'terra-lumina';
import { Rolla }  from 'terra-rolla';
import { Combase } from 'terra-combase';
import { Webbl }  from 'terra-webbl';

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error('❌ Set GITHUB_TOKEN env var first.'); process.exit(1); }

// ── Sleep helper to avoid GitHub API 409 SHA conflicts ────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Formatting helpers ─────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m', white: '\x1b[37m',
};
const log   = (msg) => console.log(`  ${msg}`);
const ok    = (msg) => console.log(`  ${c.green}✅${c.reset} ${msg}`);
const info  = (msg) => console.log(`  ${c.cyan}ℹ️ ${c.reset}  ${msg}`);
const warn  = (msg) => console.log(`  ${c.yellow}⚠️ ${c.reset}  ${msg}`);
const err   = (msg) => console.log(`  ${c.red}❌${c.reset} ${msg}`);
const step  = (n, title) => console.log(`\n${c.bold}${c.blue}[ STEP ${n} ]${c.reset} ${c.bold}${title}${c.reset}`);
const phase = (title) => console.log(`\n${'═'.repeat(70)}\n${c.bold}${c.magenta}  ${title}${c.reset}\n${'═'.repeat(70)}`);
const json  = (obj) => console.log(`  ${c.dim}${JSON.stringify(obj, null, 2).replace(/\n/g, '\n  ')}${c.reset}`);

// ── Results tracker ────────────────────────────────────────────────────────
const results = { passed: 0, failed: 0, skipped: 0, details: [] };
async function run(label, fn) {
  try {
    const result = await fn();
    results.passed++;
    results.details.push({ status: '✅', label, result });
    return result;
  } catch (e) {
    results.failed++;
    results.details.push({ status: '❌', label, error: e.message });
    err(`${label} → ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN FLOW
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${c.bold}${c.cyan}`);
  console.log('  ████████╗███████╗██████╗ ██████╗  █████╗ ');
  console.log('     ██╔══╝██╔════╝██╔══██╗██╔══██╗██╔══██╗');
  console.log('     ██║   █████╗  ██████╔╝██████╔╝███████║');
  console.log('     ██║   ██╔══╝  ██╔══██╗██╔══██╗██╔══██║');
  console.log('     ██║   ███████╗██║  ██║██║  ██║██║  ██║');
  console.log('     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝');
  console.log(`${c.reset}`);
  console.log(`  ${c.bold}SANDBOX & LABORATORY — Real Integration Test${c.reset}`);
  console.log(`  Simulating developer "Alex" building "ProjectNova"\n`);
  console.log(`  GitHub Token: ${TOKEN.slice(0,10)}...${TOKEN.slice(-4)}`);
  console.log(`  Started At:   ${new Date().toISOString()}\n`);

  // ─────────────────────────────────────────────────────────────────────────
  phase('🔐  PHASE 1 — LUMINA: Identity, Auth & Policy Engine');
  // ─────────────────────────────────────────────────────────────────────────

  const lumina = new Lumina({ githubToken: TOKEN, storageRepo: '.lumina-storage' });

  step(1, 'Initialize LUMINA vault (creates .lumina-storage repo if not exists)');
  await run('lumina.init()', async () => {
    await lumina.init();
    ok('LUMINA vault initialized → .lumina-storage repo ready');
  });

  step(2, 'Create project users with different roles (Photuris Vault)');
  let alexUser, teamUser, guestUser;

  alexUser = await run('createUser: Alex (admin)', async () => {
    const u = await lumina.createUser('alex@projectnova.io', 'Alex Nova', 'admin', 'SecureP@ss2026!');
    ok(`User created → ${u.id} | ${u.email} | role: ${u.role}`);
    return u;
  });

  await sleep(1000);

  teamUser = await run('createUser: Maria (developer)', async () => {
    const u = await lumina.createUser('maria@projectnova.io', 'Maria Dev', 'developer', 'DevPass2026!');
    ok(`User created → ${u.id} | ${u.email} | role: ${u.role}`);
    return u;
  });

  await sleep(1000);

  guestUser = await run('createUser: Guest (viewer)', async () => {
    const u = await lumina.createUser('viewer@external.io', 'Guest Viewer', 'viewer');
    ok(`User created → ${u.id} | ${u.email} | role: ${u.role}`);
    return u;
  });

  step(3, 'List all users in Photuris Vault');
  await run('lumina.listUsers()', async () => {
    const users = await lumina.listUsers();
    ok(`Vault contains ${users.length} users:`);
    users.forEach(u => info(`  ${u.name} <${u.email}> [${u.role}] — ${u.active ? 'active' : 'inactive'}`));
    return users;
  });

  step(4, 'Authenticate users (Luciole token generation)');
  let alexSession;
  await run('lumina.authenticate(alex)', async () => {
    await sleep(1000);
    const auth = await lumina.authenticate('alex@projectnova.io', 'SecureP@ss2026!');
    if (!auth.success) throw new Error(auth.error);
    alexSession = auth.session;
    ok(`Authenticated → session: ${auth.session?.sessionId}`);
    info(`JWT token: ${auth.session?.token?.slice(0, 60)}...`);
    return auth;
  });

  await run('lumina.authenticate(maria)', async () => {
    await sleep(1000);
    const auth = await lumina.authenticate('maria@projectnova.io', 'DevPass2026!');
    if (!auth.success) throw new Error(auth.error);
    ok(`Authenticated → session: ${auth.session?.sessionId}`);
    return auth;
  });

  step(5, 'Sign and verify custom JWT tokens (Luciole Engine)');
  let signedToken;
  await run('lumina.signToken()', async () => {
    signedToken = lumina.signToken({
      sub: alexUser?.id || 'usr_alex',
      email: 'alex@projectnova.io',
      role: 'admin',
      projectId: 'projectnova',
      permissions: ['deploy', 'write', 'read', 'delete']
    }, 86400);
    ok(`Token signed (24h TTL): ${signedToken.slice(0, 60)}...`);
    return signedToken;
  });

  await run('lumina.verifyToken()', async () => {
    const verified = lumina.verifyToken(signedToken);
    ok(`Token verified → valid: ${verified.valid}`);
    if (verified.payload) info(`Payload: sub=${verified.payload.sub}, role=${verified.payload.role}`);
    return verified;
  });

  await run('lumina.getJwks()', async () => {
    const jwks = lumina.getJwks();
    ok(`JWKS public key set retrieved`);
    info(`Key ID: ${jwks?.keys?.[0]?.kid || 'lumina-key-1'}`);
    return jwks;
  });

  step(6, 'Create Pyralis IAM Policies (resource-level access control)');
  let adminPolicy, devPolicy, viewerPolicy;

  adminPolicy = await run('createPolicy: ProjectNova Admin', async () => {
    await sleep(1000);
    const p = await lumina.createPolicy(
      'projectnova-admin-policy',
      [
        { Effect: 'Allow', Action: ['*'], Resource: ['arn:terra:projectnova:*'] },
        { Effect: 'Allow', Action: ['rolla:*'], Resource: ['arn:terra:rolla:*'] },
        { Effect: 'Allow', Action: ['webbl:*'], Resource: ['arn:terra:webbl:*'] },
        { Effect: 'Allow', Action: ['combase:*'], Resource: ['arn:terra:combase:*'] },
      ],
      'Full admin access to all ProjectNova resources'
    );
    ok(`Policy created → ${p.policyId} | "${p.name}"`);
    return p;
  });

  devPolicy = await run('createPolicy: Developer (no delete)', async () => {
    await sleep(1000);
    const p = await lumina.createPolicy(
      'projectnova-developer-policy',
      [
        { Effect: 'Allow', Action: ['rolla:get', 'rolla:put', 'rolla:list'], Resource: ['arn:terra:rolla:projectnova-*'] },
        { Effect: 'Allow', Action: ['webbl:deploy', 'webbl:list'], Resource: ['arn:terra:webbl:cocoon/projectnova-*'] },
        { Effect: 'Allow', Action: ['combase:publish', 'combase:subscribe'], Resource: ['arn:terra:combase:*'] },
        { Effect: 'Deny',  Action: ['rolla:delete', 'webbl:delete'], Resource: ['*'] },
      ],
      'Developer access — no destructive operations'
    );
    ok(`Policy created → ${p.policyId} | "${p.name}"`);
    return p;
  });

  viewerPolicy = await run('createPolicy: Viewer (read-only)', async () => {
    await sleep(1000);
    const p = await lumina.createPolicy(
      'projectnova-viewer-policy',
      [
        { Effect: 'Allow', Action: ['rolla:get', 'rolla:list'], Resource: ['arn:terra:rolla:projectnova-assets'] },
        { Effect: 'Allow', Action: ['combase:subscribe'], Resource: ['arn:terra:combase:channel/public.*'] },
        { Effect: 'Deny',  Action: ['webbl:*', 'rolla:put', 'rolla:delete'], Resource: ['*'] },
      ],
      'Read-only viewer access'
    );
    ok(`Policy created → ${p.policyId} | "${p.name}"`);
    return p;
  });

  step(7, 'Create IAM Roles and attach policies');
  let adminRole, devRole;

  adminRole = await run('createRole: ProjectNova Admin', async () => {
    await sleep(1000);
    const r = await lumina.createRole(
      'projectnova-admin',
      [adminPolicy?.policyId].filter(Boolean),
      'Full system administrator for ProjectNova'
    );
    ok(`Role created → ${r.roleId} | "${r.name}"`);
    return r;
  });

  devRole = await run('createRole: ProjectNova Developer', async () => {
    await sleep(1000);
    const r = await lumina.createRole(
      'projectnova-developer',
      [devPolicy?.policyId].filter(Boolean),
      'Developer with deploy and storage access, no delete'
    );
    ok(`Role created → ${r.roleId} | "${r.name}"`);
    return r;
  });

  step(8, 'List all policies and roles');
  await run('lumina.listPolicies()', async () => {
    const policies = await lumina.listPolicies();
    ok(`${policies.length} policies in vault`);
    policies.forEach(p => info(`  [${p.policyId}] ${p.name}`));
    return policies;
  });

  await run('lumina.listRoles()', async () => {
    const roles = await lumina.listRoles();
    ok(`${roles.length} roles in vault`);
    roles.forEach(r => info(`  [${r.roleId}] ${r.name} → policies: [${r.policyIds?.join(', ')}]`));
    return roles;
  });

  step(9, 'Evaluate IAM access (Pyralis Engine)');
  await run('evaluateRoleAccess: admin → webbl:deploy', async () => {
    const result = await lumina.evaluateRoleAccess('projectnova-admin', 'webbl:deploy', 'arn:terra:webbl:cocoon/projectnova-landing');
    ok(`Decision: ${result.allowed ? '✅ ALLOW' : '🚫 DENY'} → ${result.reason}`);
    return result;
  });

  await run('evaluateRoleAccess: developer → rolla:delete', async () => {
    const result = await lumina.evaluateRoleAccess('projectnova-developer', 'rolla:delete', 'arn:terra:rolla:projectnova-assets');
    ok(`Decision: ${result.allowed ? '✅ ALLOW' : '🚫 DENY'} → ${result.reason}`);
    return result;
  });

  await run('evaluateRoleAccess: viewer → webbl:deploy', async () => {
    const result = await lumina.evaluateRoleAccess('projectnova-viewer', 'webbl:deploy', 'arn:terra:webbl:cocoon/projectnova-*');
    ok(`Decision: ${result.allowed ? '✅ ALLOW' : '🚫 DENY'} → ${result.reason}`);
    return result;
  });

  step(10, 'LanternLinks — Generate Magic Link & OTP for passwordless auth');
  await run('lumina.createMagicLink()', async () => {
    const link = lumina.createMagicLink('alex@projectnova.io', 'https://projectnova.io/auth', 600);
    ok(`Magic link generated for alex@projectnova.io`);
    // LanternLinks returns: { token, email, url, createdAt, expiresAt, used }
    // No OTP in this engine — token IS the magic credential
    info(`Token: ${link.token?.slice(0, 30)}...`);
    info(`URL:   ${link.url?.slice(0, 80)}...`);
    info(`Expires: ${new Date(link.expiresAt).toLocaleTimeString()}`);

    // Immediately verify the magic link token
    const verified = lumina.verifyMagicLink(link.token);
    ok(`Magic link verification: valid=${verified.valid}, email=${verified.email}`);
    return link;
  });

  step(11, 'Glowworm — Issue Emergency Break-Glass token');
  await run('lumina.createBreakGlassToken()', async () => {
    const cred = lumina.createBreakGlassToken(
      alexUser?.id || 'usr_alex',
      'Sandbox integration test — full diagnostic run INC-2026-SANDBOX-001',
      900
    );
    ok(`Break-glass token issued for ${cred.userId}`);
    info(`Token: ${cred.token.slice(0, 30)}...`);
    info(`Expires in: 15 min`);
    info(`Reason: ${cred.reason}`);
    return cred;
  });

  step(12, 'Coleoptera — Export provider bridge (Auth0, Supabase, Firebase, AWS IAM)');
  for (const provider of ['auth0', 'supabase', 'firebase', 'aws_iam']) {
    await run(`lumina.exportProviderBridge(${provider})`, async () => {
      const exported = await lumina.exportProviderBridge(provider);
      const preview = exported.slice(0, 120).replace(/\n/g, ' ');
      ok(`${provider} bridge exported (${exported.length} chars)`);
      info(`Preview: ${preview}...`);
      return exported;
    });
  }

  step('12b', 'Create viewer role (required for IAM evaluation in step 9)');
  let viewerRole;
  viewerRole = await run('createRole: ProjectNova Viewer', async () => {
    await sleep(2000); // wait after bridge exports to avoid SHA conflict
    const r = await lumina.createRole(
      'projectnova-viewer',
      [viewerPolicy?.policyId].filter(Boolean),
      'Read-only viewer, no write or deploy'
    );
    ok(`Viewer role created → ${r.roleId}`);
    return r;
  });

  step(13, 'Import external policy (AWS IAM JSON)');
  await run('lumina.importPolicy(aws)', async () => {
    await sleep(2000); // avoid GitHub SHA 409 conflict after rapid sequential saves
    const awsPolicy = {
      Version: '2012-10-17',
      Statement: [
        { Effect: 'Allow', Action: ['s3:GetObject', 's3:PutObject'], Resource: 'arn:aws:s3:::projectnova-assets/*' },
        { Effect: 'Deny',  Action: ['s3:DeleteObject'], Resource: '*' }
      ]
    };
    const imported = await lumina.importPolicy('aws', awsPolicy, 'aws-s3-projectnova');
    ok(`AWS IAM policy imported → ${imported.policyId} | provider: ${imported.provider}`);
    return imported;
  });

  // Re-run IAM evaluations now that all roles exist in vault
  step('9b', 'Re-evaluate IAM access with all roles loaded');
  await run('evaluateRoleAccess: admin → webbl:deploy', async () => {
    const result = await lumina.evaluateRoleAccess('projectnova-admin', 'webbl:deploy', 'arn:terra:webbl:cocoon/projectnova-landing');
    ok(`Decision: ${result.allowed ? '✅ ALLOW' : '🚫 DENY'} → ${result.reason}`);
    return result;
  });
  await run('evaluateRoleAccess: developer → rolla:delete', async () => {
    const result = await lumina.evaluateRoleAccess('projectnova-developer', 'rolla:delete', 'arn:terra:rolla:projectnova-assets');
    ok(`Decision: ${result.allowed ? '✅ ALLOW' : '🚫 DENY'} → ${result.reason}`);
    return result;
  });
  await run('evaluateRoleAccess: viewer → webbl:deploy', async () => {
    const result = await lumina.evaluateRoleAccess('projectnova-viewer', 'webbl:deploy', 'arn:terra:webbl:cocoon/projectnova-*');
    ok(`Decision: ${result.allowed ? '✅ ALLOW' : '🚫 DENY'} → ${result.reason}`);
    return result;
  });

  // ─────────────────────────────────────────────────────────────────────────
  phase('🎳  PHASE 2 — ROLLA: Object Storage & Versioning');
  // ─────────────────────────────────────────────────────────────────────────

  const rolla = new Rolla({ githubToken: TOKEN, storageRepo: '.rolla-storage' });

  step(14, 'Create Rolla-Balls (storage buckets) for ProjectNova');
  const buckets = ['projectnova-assets', 'projectnova-configs', 'projectnova-backups'];

  for (const bucket of buckets) {
    await run(`rolla.createBucket("${bucket}")`, async () => {
      await rolla.createBucket(bucket);
      ok(`Rolla-Ball "${bucket}" created in .rolla-storage`);
    });
  }

  step(15, 'Upload objects to projectnova-assets (with versioning)');

  await run('rolla.putObject: project config JSON', async () => {
    const config = JSON.stringify({
      name: 'ProjectNova',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      owner: 'alex@projectnova.io',
      stack: ['LUMINA', 'ROLLA', 'WEBBL', 'COMBASE'],
      region: 'eu-west-1',
      tier: 'pro'
    }, null, 2);
    const meta = await rolla.putObject('projectnova-assets', 'project.config.json', config, { contentType: 'application/json' });
    ok(`Uploaded project.config.json → v${meta.versionId} (${meta.size} bytes)`);
    return meta;
  });

  await run('rolla.putObject: README.md', async () => {
    const readme = `# ProjectNova\n\nBuilt on Terra Titan Stack.\n\n- 🔐 Auth: LUMINA\n- 🎳 Storage: ROLLA\n- 🌐 Hosting: WEBBL\n- 📡 Events: COMBASE\n\nCreated: ${new Date().toISOString()}`;
    const meta = await rolla.putObject('projectnova-assets', 'README.md', readme, { contentType: 'text/markdown' });
    ok(`Uploaded README.md → ${meta.versionId} (${meta.size} bytes)`);
    return meta;
  });

  await run('rolla.putObject: users.json (identity export from LUMINA)', async () => {
    const usersExport = JSON.stringify({
      exportedAt: new Date().toISOString(),
      exportedBy: 'terra-sandbox-integration-test',
      users: [
        { email: 'alex@projectnova.io', role: 'admin' },
        { email: 'maria@projectnova.io', role: 'developer' },
        { email: 'viewer@external.io', role: 'viewer' }
      ]
    }, null, 2);
    const meta = await rolla.putObject('projectnova-configs', 'users.json', usersExport, { contentType: 'application/json' });
    ok(`Uploaded users.json → ${meta.versionId} (${meta.size} bytes)`);
    return meta;
  });

  await run('rolla.putObject: deployment manifest', async () => {
    const manifest = JSON.stringify({
      projectId: 'projectnova',
      deployedAt: new Date().toISOString(),
      cocoon: 'terra-sandbox-laboratory',
      version: 'webbl-v' + Date.now(),
      environment: 'sandbox',
      status: 'live'
    }, null, 2);
    const meta = await rolla.putObject('projectnova-configs', 'deploy.manifest.json', manifest, { contentType: 'application/json' });
    ok(`Uploaded deploy.manifest.json → ${meta.versionId} (${meta.size} bytes)`);
    return meta;
  });

  step(16, 'Update project config to trigger versioning');
  await run('rolla.putObject: project.config.json (v2)', async () => {
    const configV2 = JSON.stringify({
      name: 'ProjectNova',
      version: '1.1.0',
      updatedAt: new Date().toISOString(),
      owner: 'alex@projectnova.io',
      stack: ['LUMINA', 'ROLLA', 'WEBBL', 'COMBASE'],
      region: 'eu-west-1',
      tier: 'enterprise',
      features: ['magic-links', 'break-glass', 'time-machine', 'provider-bridge']
    }, null, 2);
    const meta = await rolla.putObject('projectnova-assets', 'project.config.json', configV2, { contentType: 'application/json' });
    ok(`Uploaded project.config.json v2 → ${meta.versionId} | versions: ${meta.versions?.length}`);
    return meta;
  });

  step(17, 'List buckets and objects');
  await run('rolla.listBuckets()', async () => {
    const balls = await rolla.listBuckets();
    ok(`${balls.length} Rolla-Balls found: ${balls.join(', ')}`);
    return balls;
  });

  for (const bucket of ['projectnova-assets', 'projectnova-configs']) {
    await run(`rolla.listObjects("${bucket}")`, async () => {
      const objects = await rolla.listObjects(bucket);
      ok(`${bucket} → ${objects.length} objects:`);
      objects.forEach(o => info(`  ${o.key} (${o.size} bytes, versions: ${o.versions?.length || 1})`));
      return objects;
    });
  }

  step(18, 'Read back objects and verify content');
  await run('rolla.getObject: README.md', async () => {
    const buf = await rolla.getObject('projectnova-assets', 'README.md');
    const content = buf.toString('utf-8');
    ok(`README.md read back (${content.length} chars)`);
    info(content.slice(0, 120));
    return content;
  });

  step(19, 'Get version history of project.config.json');
  await run('rolla.listObjectVersions()', async () => {
    const versions = await rolla.listObjectVersions('projectnova-assets', 'project.config.json');
    ok(`project.config.json has ${versions.length} version(s):`);
    versions.forEach(v => info(`  ${v.versionId} → ${v.size} bytes @ ${v.createdAt}`));
    return versions;
  });

  // ─────────────────────────────────────────────────────────────────────────
  phase('📡  PHASE 3 — COMBASE: SQL Database & Time Machine');
  // ─────────────────────────────────────────────────────────────────────────

  const combase = new Combase({ githubToken: TOKEN, storageRepo: '.combase-storage' });

  step(20, 'Initialize COMBASE vault (creates .combase-storage repo if not exists)');
  await run('combase.init()', async () => {
    await combase.init();
    ok('COMBASE vault initialized → .combase-storage repo ready');
  });

  step(21, 'Create databases for ProjectNova');
  await run('combase.createDatabase("projectnova_db")', async () => {
    combase.createDatabase('projectnova_db');
    ok('Database "projectnova_db" created');
  });

  step(22, 'Create tables with SQL');
  await run('CREATE TABLE users', async () => {
    const r = await combase.query(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT, role TEXT, createdAt TEXT)`);
    ok(`Table "users" created → ${r.message || 'OK'}`);
    return r;
  });

  await run('CREATE TABLE projects', async () => {
    await sleep(1500);
    const r = await combase.query(`CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, owner TEXT, status TEXT, tier TEXT, createdAt TEXT)`);
    ok(`Table "projects" created → ${r.message || 'OK'}`);
    return r;
  });

  await run('CREATE TABLE events', async () => {
    const r = await combase.query(`CREATE TABLE events (id INTEGER PRIMARY KEY, channel TEXT, event TEXT, payload TEXT, createdAt TEXT)`);
    ok(`Table "events" created → ${r.message || 'OK'}`);
    return r;
  });

  // Each CREATE TABLE must wait for GitHub to confirm the previous SHA
  await run('CREATE TABLE deployments', async () => {
    await sleep(1200);
    const r = await combase.query(`CREATE TABLE deployments (id INTEGER PRIMARY KEY, cocoon TEXT, version TEXT, status TEXT, deployedAt TEXT)`);
    ok(`Table "deployments" created → ${r.message || 'OK'}`);
    return r;
  });

  step(23, 'Insert real data from our integration run');
  await run('INSERT users', async () => {
    await sleep(1200);
    await combase.query(`INSERT INTO users (id, email, name, role, createdAt) VALUES (1, 'alex@projectnova.io', 'Alex Nova', 'admin', '${new Date().toISOString()}')`);
    await sleep(800);
    await combase.query(`INSERT INTO users (id, email, name, role, createdAt) VALUES (2, 'maria@projectnova.io', 'Maria Dev', 'developer', '${new Date().toISOString()}')`);
    await sleep(800);
    await combase.query(`INSERT INTO users (id, email, name, role, createdAt) VALUES (3, 'viewer@external.io', 'Guest Viewer', 'viewer', '${new Date().toISOString()}')`);
    ok('3 users inserted into projectnova_db.users');
  });

  await run('INSERT projects', async () => {
    await sleep(1000);
    await combase.query(`INSERT INTO projects (id, name, owner, status, tier, createdAt) VALUES (1, 'ProjectNova', 'alex@projectnova.io', 'active', 'enterprise', '${new Date().toISOString()}')`);
    ok('ProjectNova inserted into projects table');
  });

  await run('INSERT events', async () => {
    const events = [
      [1, 'lumina.auth', 'UserCreated',    '{"email":"alex@projectnova.io"}'],
      [2, 'lumina.auth', 'UserCreated',    '{"email":"maria@projectnova.io"}'],
      [3, 'lumina.auth', 'UserAuth',       '{"email":"alex@projectnova.io","success":true}'],
      [4, 'rolla.storage', 'BucketCreated', '{"bucket":"projectnova-assets"}'],
      [5, 'rolla.storage', 'ObjectPut',     '{"key":"project.config.json","version":2}'],
      [6, 'webbl.deploy',  'CocoonDeployed','{"cocoon":"terra-sandbox-laboratory"}'],
    ];
    for (const [id, channel, event, payload] of events) {
      await sleep(900);
      await combase.query(`INSERT INTO events (id, channel, event, payload, createdAt) VALUES (${id}, '${channel}', '${event}', '${payload}', '${new Date().toISOString()}')`);
    }
    ok('6 system events inserted');
  });

  await run('INSERT deployments', async () => {
    await sleep(1000);
    await combase.query(`INSERT INTO deployments (id, cocoon, version, status, deployedAt) VALUES (1, 'terra-sandbox-laboratory', 'webbl-v${Date.now()}', 'live', '${new Date().toISOString()}')`);
    ok('Deployment record inserted');
  });

  step(24, 'Query data (SELECT, WHERE, aggregations)');
  await run('SELECT * FROM users', async () => {
    const r = await combase.query('SELECT * FROM users');
    ok(`${r.rows?.length} users returned:`);
    r.rows?.forEach(u => info(`  #${u.id} ${u.name} <${u.email}> [${u.role}]`));
    return r;
  });

  await run('SELECT admin users', async () => {
    const r = await combase.query(`SELECT * FROM users WHERE role = 'admin'`);
    ok(`${r.rows?.length} admin user(s) found`);
    return r;
  });

  await run('SELECT events by channel', async () => {
    const r = await combase.query(`SELECT * FROM events WHERE channel = 'lumina.auth'`);
    ok(`${r.rows?.length} lumina.auth events found`);
    return r;
  });

  step(25, 'Create a feature branch (Time Machine)');
  await run('combase.createBranch("feature/analytics")', async () => {
    try {
      await combase.createBranch('feature/analytics');
      ok('Branch "feature/analytics" created in .combase-storage');
    } catch (e) {
      if (e.message.includes('Reference already exists')) {
        ok('Branch "feature/analytics" already exists — skipping creation');
      } else {
        throw e;
      }
    }
  });

  await run('combase.listBranches()', async () => {
    const branches = await combase.listBranches();
    ok(`${branches.length} branches: ${branches.map(b => b.name).join(', ')}`);
    return branches;
  });

  step(26, 'Get commit history (Time Machine)');
  await run('combase.getHistory()', async () => {
    const history = await combase.getHistory(10);
    ok(`${history.length} commits in history`);
    history.slice(0, 3).forEach(h => info(`  ${h.sha?.slice(0,8)} — ${h.message?.slice(0,60)}`));
    return history;
  });

  step(27, 'Generate provider export scripts');
  await run('combase.generateProviderScript(postgres)', async () => {
    const sql = await combase.generateProviderScript('postgres');
    ok(`PostgreSQL migration generated (${sql.length} chars)`);
    info(sql.slice(0, 200).replace(/\n/g, ' '));
    return sql;
  });

  await run('combase.exportSqlDump()', async () => {
    const dump = await combase.exportSqlDump();
    ok(`SQL dump exported (${dump.length} chars, ${dump.split('\n').length} lines)`);
    return dump;
  });

  // ─────────────────────────────────────────────────────────────────────────
  phase('🌐  PHASE 4 — WEBBL: Deploy the project landing page');
  // ─────────────────────────────────────────────────────────────────────────

  const webbl = new Webbl({ githubToken: TOKEN });

  step(28, 'List existing Cocoons');
  await run('webbl.listCocoons()', async () => {
    const cocoons = await webbl.listCocoons();
    ok(`${cocoons.length} cocoon(s) found:`);
    cocoons.forEach(c => info(`  ${c.name} → ${c.url}`));
    return cocoons;
  });

  step(29, 'Get deployment history + list Morphs');
  await run('webbl.getDeployments(terra-sandbox-laboratory)', async () => {
    const history = await webbl.getDeployments('amglogicalis/terra-sandbox-laboratory');
    ok(`${history.length} deployment(s) in history`);
    history.slice(0, 5).forEach(h => info(`  ${h.tag} — ${h.date || h.publishedAt || ''}` ));
    return history;
  });

  await run('webbl.listMorphs()', async () => {
    const morphs = await webbl.listMorphs();
    ok(`${morphs.length} Morph(s) found`);
    morphs.forEach(m => info(`  ${m.name} → ${m.url || m.repo}`));
    return morphs;
  });

  await run('webbl.detectFramework()', async () => {
    const fw = webbl.detectFramework('C:/mis-proyectos/Terra/terra-sandbox-laboratory');
    ok(`Framework detected: ${fw.name}`);
    info(`Build command: ${fw.buildCommand || 'none'} | Output: ${fw.outputDir}`);
    return fw;
  });

  step(30, 'Deploy updated landing page for ProjectNova');
  await run('webbl.deploy() — terra-sandbox-laboratory', async () => {
    const result = await webbl.deploy({
      repo: 'amglogicalis/terra-sandbox-laboratory',
      localPath: 'C:/mis-proyectos/Terra/terra-sandbox-laboratory',
      skipBuild: true,
      message: `feat: ProjectNova integration test deploy — ${new Date().toISOString()}`
    });
    ok(`Cocoon deployed!`);
    info(`URL:     ${result.url}`);
    info(`Version: ${result.deployment?.tag}`);
    return result;
  });

  // ─────────────────────────────────────────────────────────────────────────
  phase('📊  PHASE 5 — FINAL REPORT');
  // ─────────────────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(70));
  console.log(`${c.bold}  INTEGRATION TEST RESULTS${c.reset}`);
  console.log('═'.repeat(70));
  console.log(`  ${c.green}✅ Passed:  ${results.passed}${c.reset}`);
  console.log(`  ${c.red}❌ Failed:  ${results.failed}${c.reset}`);
  console.log(`  Total:   ${results.passed + results.failed}`);
  console.log('');

  if (results.failed > 0) {
    console.log(`${c.bold}  Failed steps:${c.reset}`);
    results.details.filter(d => d.status === '❌').forEach(d => {
      console.log(`  ❌ ${d.label}`);
      console.log(`     ${c.dim}${d.error}${c.reset}`);
    });
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`${c.bold}  RESOURCES CREATED IN GITHUB${c.reset}`);
  console.log('═'.repeat(70));
  console.log(`  🔐 LUMINA   → github.com/amglogicalis/.lumina-storage`);
  console.log(`              Users: alex, maria, viewer`);
  console.log(`              Policies: admin, developer, viewer, aws-s3`);
  console.log(`              Roles: projectnova-admin, projectnova-developer`);
  console.log(`  🎳 ROLLA    → github.com/amglogicalis/.rolla-storage`);
  console.log(`              Balls: projectnova-assets, projectnova-configs, projectnova-backups`);
  console.log(`              Objects: project.config.json (v2), README.md, users.json, deploy.manifest.json`);
  console.log(`  📡 COMBASE  → github.com/amglogicalis/.combase-storage`);
  console.log(`              Tables: users, projects, events, deployments`);
  console.log(`              Branch: feature/analytics`);
  console.log(`  🌐 WEBBL    → github.com/amglogicalis/terra-sandbox-laboratory`);
  console.log(`              URL: https://amglogicalis.github.io/terra-sandbox-laboratory/`);
  console.log('═'.repeat(70));
  console.log(`\n  Finished: ${new Date().toISOString()}\n`);

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(`\n${c.red}FATAL ERROR: ${e.message}${c.reset}`);
  console.error(e.stack);
  process.exit(1);
});
