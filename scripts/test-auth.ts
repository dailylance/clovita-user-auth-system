import { db } from '../src/lib/db.js';
import AuthService from '../src/services/authService.js';

function log(step: string, data?: unknown) {
  console.log(`\n=== ${step} ===`);
  if (data !== undefined) console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const ts = Date.now();
  const email = `auth-test-${ts}@example.com`;
  const username = `auth_test_${ts}`;
  const password = 'P@ssw0rd123';
  const newPassword = 'P@ssw0rd456';

  await db.connect();

  // 1) Register
  const reg = await AuthService.register({ email, username, password }, 'seed-1');
  log('1) Register', { user: reg.user, accessToken: !!reg.accessToken, refreshToken: !!reg.refreshToken, emailVerificationToken: !!reg.emailVerificationToken });

  // 2) Verify email (simulate clicking email link)
  const verify = await AuthService.verifyEmail({ token: reg.emailVerificationToken }, 'seed-2');
  log('2) Verify Email', verify);

  // 3) Login
  const login1 = await AuthService.login({ email, password }, 'seed-3');
  log('3) Login', { user: login1.user, accessToken: !!login1.accessToken, refreshToken: !!login1.refreshToken });

  // 4) Refresh (rotate)
  const refresh1 = await AuthService.refresh({ refreshToken: login1.refreshToken }, { ip: '127.0.0.1', userAgent: 'seed-script' }, 'seed-4');
  log('4) Refresh', { accessToken: !!refresh1.accessToken, refreshToken: !!refresh1.refreshToken });

  // 5) List sessions
  const sessions1 = await db.client.token.findMany({ where: { userId: login1.user.id, type: 'REFRESH', revoked: false }, orderBy: { createdAt: 'desc' } });
  log('5) Sessions (active)', sessions1.map(s => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, revoked: s.revoked })));

  // 6) Logout (revoke current refresh)
  await AuthService.logout({ refreshToken: refresh1.refreshToken }, 'seed-5');
  const sessions2 = await db.client.token.findMany({ where: { userId: login1.user.id, type: 'REFRESH' }, orderBy: { createdAt: 'desc' } });
  log('6) Logout -> Sessions (all)', sessions2.map(s => ({ id: s.id, revoked: s.revoked, usedAt: s.usedAt })));

  // 7) Request password reset
  const resetReq = await AuthService.requestPasswordReset({ email }, 'seed-6');
  log('7) Reset Request', { sent: resetReq.sent, resetToken: !!resetReq.resetToken });

  // 8) Reset password
  if (!resetReq.resetToken) throw new Error('No resetToken returned');
  const resetRes = await AuthService.resetPassword({ token: resetReq.resetToken, password: newPassword }, 'seed-7');
  log('8) Reset Password', resetRes);

  // 9) Login with new password
  const login2 = await AuthService.login({ email, password: newPassword }, 'seed-8');
  log('9) Login with new password', { user: login2.user, ok: !!login2.accessToken });

  console.log('\n✅ Auth flow test finished successfully');
}

main().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
}).finally(async () => {
  try { await db.disconnect(); } catch {}
});
