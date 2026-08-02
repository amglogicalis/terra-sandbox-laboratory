import { Rolla } from '../rolla/Rolla/packages/rolla-sdk/dist/index.js';
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

console.log('📦 Uploading TERRA_MASTER_HANDOVER.md to Rolla storage...');

const rolla = new Rolla({ githubToken: token });

const bucketName = 'rolla-ball-terra';
try {
  await rolla.createBall(bucketName);
} catch { /* bucket may already exist */ }

const handoverPath = 'c:/mis-proyectos/Terra/TERRA_MASTER_HANDOVER.md';
const fileBuffer = fs.readFileSync(handoverPath);

const result = await rolla.putObject(bucketName, 'TERRA_MASTER_HANDOVER.md', fileBuffer, {
  contentType: 'text/markdown'
});

console.log('✅ Handover uploaded to Rolla successfully!');
console.log('   Metadata:', result);
