import { Lumina } from '../lumina/Lumina/packages/lumina-sdk/dist/index.js';
import fs from 'node:fs';
import path from 'node:path';

// Read GITHUB_TOKEN from process.env or .env file
let token = process.env.GITHUB_TOKEN;
if (!token && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const match = envContent.match(/GITHUB_TOKEN=(.+)/);
  if (match) token = match[1].trim();
}
if (!token && fs.existsSync('../.env')) {
  const envContent = fs.readFileSync('../.env', 'utf-8');
  const match = envContent.match(/GITHUB_TOKEN=(.+)/);
  if (match) token = match[1].trim();
}

if (!token) {
  console.error('❌ GITHUB_TOKEN environment variable or .env file is required');
  process.exit(1);
}

console.log('🧪 Starting LUMINA v1.1.0 Verification Test Suite...\n');

const lumina = new Lumina({
  githubToken: token,
  storageRepo: '.lumina-storage',
  branch: 'main'
});

try {
  await lumina.init();
  console.log('✅ 1. Initialized Lumina SDK v1.1.0');

  // Test 1: Sanctuary Management
  const sanctsBefore = await lumina.listSancts();
  console.log(`✅ 2. Listed initial sanctuaries: ${sanctsBefore.map(s => s.name).join(', ')}`);

  const sanctProd = await lumina.createSanct('production-v11', 'Entorno de Producción');
  console.log(`✅ 3. Created Sanctuary 'production-v11' (ID: ${sanctProd.sanctId})`);

  await lumina.switchSanct('production-v11');
  const activeSanct = await lumina.getActiveSanct();
  console.log(`✅ 4. Switched active Sanctuary to '${activeSanct}'`);

  // Test 2: Multi-role User Creation & Editing
  const user = await lumina.createUser(
    'alice.v11@terra.dev',
    'Alice Vance',
    ['admin', 'developer', 'auditor']
  );
  console.log(`✅ 5. Created User '${user.name}' with multi-roles: ${user.roles.join(', ')}`);

  const updatedUser = await lumina.updateUser(user.id, {
    name: 'Alice Vance-Smith',
    roles: ['admin', 'secops']
  });
  console.log(`✅ 6. Updated User '${updatedUser.id}' name & roles: ${updatedUser.roles.join(', ')}`);

  // Test 3: Policy Creation & Editing
  const policy = await lumina.createPolicy(
    'TerraFullStorageAccess',
    [{ Effect: 'Allow', Action: ['combase:*', 'webbl:*'], Resource: 'arn:terra:*' }],
    'Acceso completo a storage y hosting',
    'terra'
  );
  console.log(`✅ 7. Created Policy '${policy.name}' (ID: ${policy.policyId})`);

  const updatedPolicy = await lumina.updatePolicy(policy.policyId, {
    name: 'TerraFullStorageAccessV2',
    description: 'Updated policy description'
  });
  console.log(`✅ 8. Updated Policy '${updatedPolicy.policyId}' name to '${updatedPolicy.name}'`);

  // Test 4: Role Creation, Attachment & Editing
  const role = await lumina.createRole(
    'CloudArchitect',
    [policy.policyId],
    'Arquitecto de nube con permisos de storage',
    'terra'
  );
  console.log(`✅ 9. Created Role '${role.name}' with attached policy '${policy.policyId}'`);

  const updatedRole = await lumina.updateRole(role.roleId, {
    name: 'LeadCloudArchitect',
    policyIds: [policy.policyId]
  });
  console.log(`✅ 10. Updated Role '${updatedRole.roleId}' name to '${updatedRole.name}'`);

  // Test 5: Multi-Role IAM Evaluation
  const evalResult = await lumina.evaluateRolesAccess(
    ['LeadCloudArchitect', 'secops'],
    'combase:query',
    'arn:terra:combase:db/users'
  );
  console.log(`✅ 11. Multi-Role Policy Evaluation: Allowed=${evalResult.allowed ? 'YES' : 'NO'}, Reason: ${evalResult.reason}`);

  if (!evalResult.allowed) throw new Error('Policy evaluation expected ALLOW but got DENY');

  // Test 6: Switch back to default sanct
  await lumina.switchSanct('default');
  console.log(`✅ 12. Switched back to sanctuary 'default'`);

  // Clean up test sanct
  await lumina.deleteSanct('production-v11');
  console.log(`✅ 13. Cleaned up test sanctuary 'production-v11'`);

  console.log('\n🎉 ALL LUMINA v1.1.0 VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀\n');

} catch (err) {
  console.error(`\n❌ VERIFICATION TEST FAILED: ${err.message}\n`, err);
  process.exit(1);
}
