import { Webbl } from '../webbl/Webbl/packages/webbl-sdk/dist/index.js';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

let token = process.env.GITHUB_TOKEN;
if (!token) {
  try {
    token = execSync('gh auth token', { stdio: 'pipe' }).toString().trim();
  } catch { /* ignore */ }
}

if (!token) {
  console.error('❌ GITHUB_TOKEN environment variable or gh auth token is required');
  process.exit(1);
}

console.log('🚀 Redeploying Lumina Web Console via WEBBL SDK...');

const webbl = new Webbl({ githubToken: token });

const result = await webbl.deploy({
  repo: 'amglogicalis/lumina-repo-public',
  localPath: 'c:/mis-proyectos/Terra/lumina/lumina-repo-public',
  outputDir: '.',
  skipBuild: true,
  message: 'WEBBL Redeploy: Lumina Studio v1.1.0 — Sanctuaries UI panel, rename modal & default protection'
});

console.log(`\n🎉 LUMINA WEB CONSOLE DEPLOYED SUCCESSFULLY!`);
console.log(`   Live URL: https://amglogicalis.github.io/lumina-repo-public/`);
console.log(`   Release Tag: ${result.deployment.tag}\n`);
