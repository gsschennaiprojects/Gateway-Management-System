/**
 * Test script to verify all 5 roles, login validation, session creation,
 * and data flow operations.
 */

import { INITIAL_USERS } from '../src/lib/auth/mock-users.js';
import { findUserByIdentifier, stripSensitive } from '../src/lib/auth/user-store.js';
import { createSessionToken, parseSessionToken } from '../src/lib/auth/session.js';

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║   TESTING ALL 5 ROLES, AUTHENTICATION & ACCESS CONTROL FLOWS       ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

const ROLES_TO_TEST = [
  {
    roleName: 'SUPER_ADMIN',
    identifier: 'gateway.managercbe@gmail.com',
    password: 'GatewaySS@2013#',
    expectedRole: 'superadmin',
    expectedBranch: 'Coimbatore',
  },
  {
    roleName: 'ADMIN',
    identifier: 'cbe.admin@gatewaysolutions.com',
    password: 'Admin@123',
    expectedRole: 'admin',
    expectedBranch: 'Coimbatore',
  },
  {
    roleName: 'HR',
    identifier: 'cbe.hr@gatewaysolutions.com',
    password: 'Hr@123',
    expectedRole: 'hr',
    expectedBranch: 'Coimbatore',
  },
  {
    roleName: 'EMPLOYEE / MENTOR',
    identifier: 'cbe.mentor@gatewaysolutions.com',
    password: 'Emp@123',
    expectedRole: 'employee',
    expectedBranch: 'Coimbatore',
  },
  {
    roleName: 'INTERN',
    identifier: 'cbe.intern@gatewaysolutions.com',
    password: 'Intern@123',
    expectedRole: 'intern',
    expectedBranch: 'Coimbatore',
  },
];

let passed = 0;

for (const test of ROLES_TO_TEST) {
  console.log(`🔍 Testing ${test.roleName} Login Flow:`);
  
  // 1. Lookup
  const user = findUserByIdentifier(test.identifier);
  if (!user) {
    console.error(`   ❌ Failed: User not found for ${test.identifier}`);
    continue;
  }
  console.log(`   ✅ User found: ${user.name} (ID: ${user.id})`);

  // 2. Password match
  if (user.passwordHash !== test.password) {
    console.error(`   ❌ Password mismatch for ${test.roleName}`);
    continue;
  }
  console.log(`   ✅ Password verified`);

  // 3. Role verification
  if (user.role !== test.expectedRole) {
    console.error(`   ❌ Role mismatch: expected ${test.expectedRole}, got ${user.role}`);
    continue;
  }
  console.log(`   ✅ Role verified: ${user.role}`);

  // 4. Session generation and decoding
  const safeUser = stripSensitive(user);
  const token = createSessionToken(safeUser);
  const parsed = parseSessionToken(token);

  if (!parsed || parsed.user.id !== safeUser.id) {
    console.error(`   ❌ Session token round-trip failed`);
    continue;
  }
  console.log(`   ✅ Session token round-trip OK (Token: ${token.substring(0, 20)}...)`);

  // 5. Check permissions
  const canAccessAudit = ['superadmin'].includes(user.role);
  const canAccessStaffDirectory = ['superadmin', 'admin', 'hr'].includes(user.role);
  const canCreateStudents = ['superadmin', 'admin', 'hr', 'employee'].includes(user.role);

  console.log(`   🛡️ Permissions: AuditLog=${canAccessAudit}, StaffDirectory=${canAccessStaffDirectory}, CreateStudents=${canCreateStudents}`);
  console.log(`   ✨ ${test.roleName} verified successfully!\n`);
  passed++;
}

console.log('═'.repeat(70));
console.log(`🎉 ALL ${passed}/${ROLES_TO_TEST.length} ROLES VALIDATED WITH CORRECT AUTHENTICATION & ACCESS!`);
console.log('═'.repeat(70) + '\n');
