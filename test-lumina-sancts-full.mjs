import { Lumina } from '../lumina/Lumina/packages/lumina-sdk/dist/index.js';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

let token = process.env.GITHUB_TOKEN;
if (!token) {
  try {
    token = execSync('gh auth token', { stdio: 'pipe' }).toString().trim();
  } catch { /* ignore */ }
}
if (!token && fs.existsSync('.env')) {
  const match = fs.readFileSync('.env', 'utf-8').match(/GITHUB_TOKEN=(.+)/);
  if (match) token = match[1].trim();
}

if (!token) {
  console.error('❌ GITHUB_TOKEN environment variable or gh auth token is required');
  process.exit(1);
}

console.log('🧪 Starting Full Lumina Sanctuaries (Environment Isolation) Verification Test...\n');

const lumina = new Lumina({ githubToken: token });
await lumina.init();

try {
  // 1. Verify default sanct exists initially
  console.log('🏛️  1. Checking active sanctuary on initial load...');
  let active = await lumina.getActiveSanct();
  console.log(`   Active Sanctuary: '${active}'`);
  if (active !== 'default') throw new Error(`Expected active sanct to be 'default', got '${active}'`);
  console.log('   ✅ Default sanctuary is present by default.\n');

  // 2. Create production and staging sanctuaries
  console.log('➕ 2. Creating "production" and "staging" sanctuaries...');
  await lumina.createSanct('production', 'Entorno de producción');
  await lumina.createSanct('staging', 'Entorno de pruebas');
  console.log('   ✅ Created "production" and "staging".\n');

  // 3. List sanctuaries
  console.log('📋 3. Listing all sanctuaries...');
  let sancts = await lumina.listSancts();
  console.table(sancts);
  const names = sancts.map(s => s.name);
  if (!names.includes('default') || !names.includes('production') || !names.includes('staging')) {
    throw new Error('Sanctuary list missing created sanctuaries!');
  }
  console.log('   ✅ All sanctuaries listed correctly.\n');

  // 4. Switch to production and add a user
  console.log('🔄 4. Switching to "production" and creating an isolated user...');
  await lumina.switchSanct('production');
  active = await lumina.getActiveSanct();
  console.log(`   Active Sanctuary: '${active}'`);
  
  const prodUser = await lumina.createUser('admin@production.com', 'Prod Admin', ['admin']);
  console.log(`   Created user in production: ${prodUser.email} (${prodUser.id})`);
  
  let prodUsers = await lumina.listUsers();
  console.log(`   Production user count: ${prodUsers.length}`);
  console.log('   ✅ User created in "production" sanctuary.\n');

  // 5. Switch to staging and verify isolation
  console.log('🛡️  5. Switching to "staging" to verify environment isolation...');
  await lumina.switchSanct('staging');
  let stagingUsers = await lumina.listUsers();
  console.log(`   Staging user count: ${stagingUsers.length}`);
  if (stagingUsers.find(u => u.email === 'admin@production.com')) {
    throw new Error('ISOLATION FAILURE: Production user leaked into Staging sanctuary!');
  }
  console.log('   ✅ Perfect isolation! Production user is NOT visible in Staging.\n');

  // 6. Rename sanctuary
  console.log('✏️  6. Renaming "staging" to "pre-prod"...');
  await lumina.renameSanct('staging', 'pre-prod');
  sancts = await lumina.listSancts();
  if (!sancts.find(s => s.name === 'pre-prod') || sancts.find(s => s.name === 'staging')) {
    throw new Error('Renaming sanctuary failed!');
  }
  console.log('   ✅ Renamed "staging" -> "pre-prod" successfully.\n');

  // 7. Delete sanctuary
  console.log('🗑️  7. Deleting "pre-prod" sanctuary...');
  await lumina.deleteSanct('pre-prod');
  sancts = await lumina.listSancts();
  if (sancts.find(s => s.name === 'pre-prod')) {
    throw new Error('Deleting sanctuary failed!');
  }
  console.log('   ✅ Sanctuary "pre-prod" deleted.\n');

  // 8. Verify default cannot be deleted
  console.log('🔒 8. Verifying "default" sanctuary protection...');
  try {
    await lumina.deleteSanct('default');
    throw new Error('FAILED: Was able to delete default sanctuary!');
  } catch (err) {
    if (err.message.includes("Cannot delete the 'default' sanctuary")) {
      console.log('   ✅ Protected! Attempting to delete "default" threw expected error: ' + err.message + '\n');
    } else {
      throw err;
    }
  }

  // Switch back to default
  await lumina.switchSanct('default');

  console.log('🎉 ALL SANCTUARY TESTS PASSED 100% SUCCESSFULLY!\n');

} catch (err) {
  console.error('❌ TEST FAILED:', err.message, err);
  process.exit(1);
}
