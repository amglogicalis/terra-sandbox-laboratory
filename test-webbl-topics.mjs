import { Webbl } from '../webbl/Webbl/packages/webbl-sdk/dist/index.js';
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

console.log('🧪 Starting WEBBL v1.1.0 Topic Tagging & Redeploy Verification Test...\n');

const webbl = new Webbl({ githubToken: token });

try {
  // 1. Tag lumina-repo-public with webbl-cocoon
  console.log('🏷️ 1. Tagging amglogicalis/lumina-repo-public with webbl-cocoon...');
  await webbl.tagAsCocoon('amglogicalis/lumina-repo-public');
  console.log('✅ Tagged amglogicalis/lumina-repo-public');

  // 2. Tag combase-repo-public if it exists
  try {
    console.log('🏷️ 2. Tagging amglogicalis/combase-repo-public with webbl-cocoon...');
    await webbl.tagAsCocoon('amglogicalis/combase-repo-public');
    console.log('✅ Tagged amglogicalis/combase-repo-public');
  } catch (e) {
    console.log('ℹ️ Note: combase-repo-public not found or skipped:', e.message);
  }

  // 3. Verify listCocoons returns lumina-repo-public
  console.log('\n🔍 3. Verifying WEBBL listCocoons()...');
  const cocoons = await webbl.listCocoons();
  console.log(`Found ${cocoons.length} Cocoon(s):`, cocoons.map(c => `${c.name} (${c.url})`));

  const luminaCocoon = cocoons.find(c => c.repo.includes('lumina-repo-public'));
  if (!luminaCocoon) {
    throw new Error('lumina-repo-public was not found in listCocoons() after tagging!');
  }
  console.log('✅ Verified lumina-repo-public is detected as a WEBBL Cocoon!');

  // 4. Redeploy lumina-repo-public using WEBBL SDK!
  console.log('\n🚀 4. Redeploying Lumina Web Console via WEBBL SDK...');
  const result = await webbl.deploy({
    repo: 'amglogicalis/lumina-repo-public',
    localPath: 'c:/mis-proyectos/Terra/lumina/lumina-repo-public',
    outputDir: '.',
    skipBuild: true,
    message: 'WEBBL Redeploy: Lumina Studio v1.1.0 (Sanctuaries & Multi-Role support)'
  });

  console.log(`\n🎉 WEBBL REDEPLOY SUCCESSFUL!`);
  console.log(`   Live URL: ${result.url}`);
  console.log(`   Release Tag: ${result.deployment.tag}\n`);

} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message, err);
  process.exit(1);
}
