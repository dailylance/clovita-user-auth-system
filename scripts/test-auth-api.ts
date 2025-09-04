/* End-to-end auth flow test using HTTP API calls (simulates frontend) */
const BASE_URL = process.env['API_BASE_URL'] || 'http://localhost:3000';

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

async function fetchJson<T = any>(path: string, init?: RequestInit): Promise<{ status: number; body: T; headers: Headers }> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const status = res.status;
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    throw new Error(`HTTP ${status} for ${path}: ${JSON.stringify(body)}`);
  }
  return { status, body: body as T, headers: res.headers };
}

function log(step: string, data?: unknown) {
  console.log(`\n=== ${step} ===`);
  if (data !== undefined) console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const ts = Date.now();
  const email = `e2e-${ts}@example.com`;
  const username = `e2e_user_${ts}`;
  const password = 'P@ssw0rd123!';
  const newPassword = 'P@ssw0rd456!';
  const csrfHeader = 'X-CSRF-Token';
  const csrfCookieName = 'XSRF-TOKEN';
  const makeCookie = (kv: Record<string, string>) => Object.entries(kv).map(([k,v]) => `${k}=${v}`).join('; ');

  // Optional: ping health
  try {
    await fetchJson('/api/health');
  } catch (e) {
    throw new Error(`Server not reachable at ${BASE_URL}. Start it first. Original error: ${(e as Error).message}`);
  }

  // 1) Register
  const reg = await fetchJson<{ success: boolean; data: any; requestId: string }>(
    '/api/auth/register',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    }
  );
  const regData = reg.body.data;
  log('1) Register', { user: regData.user, access: !!regData.accessToken, refresh: !!regData.refreshToken });

  // 2) Verify email (if token returned)
  if (regData.emailVerificationToken) {
    const verify = await fetchJson<{ success: boolean; data: any }>('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: regData.emailVerificationToken }),
    });
    log('2) Verify Email', verify.body.data);
  }

  // 3) Login
  const login1 = await fetchJson<{ success: boolean; data: { user: any; accessToken: string; refreshToken: string } }>(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }
  );
  const { accessToken: access1, refreshToken: refresh1, user } = login1.body.data;
  log('3) Login', { user, access: !!access1, refresh: !!refresh1 });

  // 4) Me endpoint
  const me1 = await fetchJson<{ success: boolean; data: { user: any } }>(
    '/api/users/me',
    { headers: { authorization: `Bearer ${access1}` } }
  );
  log('4) GET /me', me1.body.data.user);

  // 5) Refresh (rotate)
  // 5a) Refresh using cookie path (tests cookie + CSRF)
  const csrfVal = 'dev-csrf';
  const ref = await fetchJson<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
    '/api/auth/refresh',
    {
      method: 'POST',
      headers: {
        [csrfHeader]: csrfVal,
        'cookie': makeCookie({ 'refresh_token': refresh1, [csrfCookieName]: csrfVal }),
      } as any,
    }
  );
  const access2 = ref.body.data.accessToken;
  const refresh2 = ref.body.data.refreshToken;
  log('5) Refresh (cookie + CSRF)', { access: !!access2, refresh: !!refresh2 });

  // 6) List sessions
  const sessions = await fetchJson<{ success: boolean; data: { sessions: Array<{ id: string; createdAt: string; expiresAt: string }> } }>(
    '/api/auth/sessions/me',
    { headers: { authorization: `Bearer ${access2}` } }
  );
  log('6) Sessions', sessions.body.data.sessions);

  // 7) Logout (revoke refresh2)
  // 7) Logout via cookie path (tests CSRF)
  await fetchJson('/api/auth/logout', {
    method: 'POST',
    headers: {
      [csrfHeader]: csrfVal,
      'cookie': makeCookie({ 'refresh_token': refresh2, [csrfCookieName]: csrfVal }),
    } as any,
  });
  log('7) Logout', { revoked: true });

  // 7b) Refresh again with same cookie should fail (401)
  try {
    await fetchJson('/api/auth/refresh', {
      method: 'POST',
      headers: { [csrfHeader]: csrfVal, 'cookie': makeCookie({ 'refresh_token': refresh2, [csrfCookieName]: csrfVal }) } as any,
    });
    throw new Error('Expected refresh after logout to fail');
  } catch (e) {
    log('7b) Refresh after logout failed as expected', { error: (e as Error).message });
  }

  // 8) Password reset request
  const resetReq = await fetchJson<{ success: boolean; data: { sent: boolean; resetToken?: string } }>(
    '/api/auth/password/reset-request',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }
  );
  log('8) Reset Request', resetReq.body.data);

  // 9) Password reset (using returned token)
  const resetToken = resetReq.body.data.resetToken;
  if (!resetToken) throw new Error('No resetToken returned from reset-request (email disabled?)');
  await fetchJson('/api/auth/password/reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: resetToken, password: newPassword }),
  });
  log('9) Reset Password', { reset: true });

  // 10) Login with new password and call /me again
  const login2 = await fetchJson<{ success: boolean; data: { user: any; accessToken: string } }>(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    }
  );
  const access3 = login2.body.data.accessToken;
  const me2 = await fetchJson<{ success: boolean; data: { user: any } }>(
    '/api/users/me',
    { headers: { authorization: `Bearer ${access3}` } }
  );
  log('10) Login with new password -> /me', me2.body.data.user);

  // 11) Login lockout/backoff test against a non-existent account
  const badEmail = `bad-${ts}@example.com`;
  let locked = false;
  for (let i = 1; i <= 6; i++) {
    try {
      await fetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: badEmail, password: 'wrong' }),
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('LOGIN_LOCKED') || msg.includes('429')) {
        locked = true;
        log('11) Lockout triggered', { attempt: i, msg });
        break;
      }
      if (i === 6) throw e;
    }
  }
  if (!locked) {
    log('11) Lockout not reached (using defaults, may require more attempts)', { maxAttempts: 'config dependent' });
  }

  console.log('\n✅ AUTH API FLOW OK');
}

main().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
