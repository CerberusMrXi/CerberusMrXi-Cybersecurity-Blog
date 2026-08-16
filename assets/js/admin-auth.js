/* ============================================================
   Admin Authentication | admin-auth.js
   Supports MongoDB API (JWT) + localStorage fallback
   ============================================================ */

const AUTH = {
  HASH_KEY:     'sw_admin_pw_hash',
  SESSION_KEY:  'sw_admin_session',
  LOCKOUT_KEY:  'sw_admin_lockout',
  ATTEMPTS_KEY: 'sw_admin_attempts',
  MAX_ATTEMPTS: 5,
  LOCKOUT_MS:   15 * 60 * 1000,
  SESSION_MS:   2 * 60 * 60 * 1000,
};

let _authMode = 'local'; // 'api' | 'local'
let _apiNeedsSetup = false;

function getAuthMode() {
  return _authMode;
}

function isApiAuth() {
  return _authMode === 'api';
}

// ── Local password helpers ──────────────────────────────────────
function getPasswordHash() {
  return localStorage.getItem(AUTH.HASH_KEY) || null;
}

function isFirstRun() {
  if (isApiAuth()) return _apiNeedsSetup;
  return !getPasswordHash();
}

function savePasswordHash(hash) {
  localStorage.setItem(AUTH.HASH_KEY, hash);
}

async function sha256(message) {
  const msgBuffer  = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Lockout (local mode) ────────────────────────────────────────
function getLockout() {
  try { return JSON.parse(localStorage.getItem(AUTH.LOCKOUT_KEY)) || null; }
  catch { return null; }
}

function setLockout() {
  localStorage.setItem(AUTH.LOCKOUT_KEY, JSON.stringify({ until: Date.now() + AUTH.LOCKOUT_MS }));
}

function clearLockout() {
  localStorage.removeItem(AUTH.LOCKOUT_KEY);
  localStorage.removeItem(AUTH.ATTEMPTS_KEY);
}

function isLockedOut() {
  const lockout = getLockout();
  if (!lockout) return false;
  if (Date.now() < lockout.until) return true;
  clearLockout();
  return false;
}

function getRemainingLockoutMs() {
  const lockout = getLockout();
  return lockout ? Math.max(0, lockout.until - Date.now()) : 0;
}

function getAttempts() {
  return parseInt(localStorage.getItem(AUTH.ATTEMPTS_KEY) || '0', 10);
}

function incrementAttempts() {
  const attempts = getAttempts() + 1;
  localStorage.setItem(AUTH.ATTEMPTS_KEY, attempts.toString());
  if (attempts >= AUTH.MAX_ATTEMPTS) setLockout();
  return attempts;
}

// ── Session helpers ───────────────────────────────────────────
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(AUTH.SESSION_KEY)) || null; }
  catch { return null; }
}

function setSession(token) {
  sessionStorage.setItem(AUTH.SESSION_KEY, JSON.stringify({
    token,
    expires: Date.now() + AUTH.SESSION_MS,
  }));
}

function clearSession() {
  sessionStorage.removeItem(AUTH.SESSION_KEY);
  if (typeof BlogAPI !== 'undefined') BlogAPI.setToken(null);
}

function isSessionValid() {
  if (typeof BlogAPI !== 'undefined' && BlogAPI.getToken()) {
    return true;
  }
  const session = getSession();
  if (!session?.token) return false;
  if (Date.now() > session.expires) { clearSession(); return false; }
  return true;
}

function refreshSession() {
  const session = getSession();
  if (session) {
    session.expires = Date.now() + AUTH.SESSION_MS;
    sessionStorage.setItem(AUTH.SESSION_KEY, JSON.stringify(session));
  }
}

function redirectToAdmin(file) {
  // Always build a full absolute URL so clean-URL rewriting can never break paths.
  const origin = window.location.origin;
  // Detect sub-directory hosting (e.g. /my-blog/admin/... → subdir = /my-blog)
  const pathname = window.location.pathname;
  const adminIdx = pathname.indexOf('/admin');
  const subdir = adminIdx !== -1 ? pathname.substring(0, adminIdx) : '';
  const target = origin + subdir + '/admin/' + file;
  // Avoid redirect if we are already on the target (with or without .html)
  const current = window.location.href.replace(/\/$/, '').replace(/\.html$/, '');
  const expected = target.replace(/\.html$/, '');
  if (current !== expected) {
    window.location.replace(target);
  }
}

async function requireAuth() {
  await initAuthMode();
  if (isApiAuth() && typeof BlogAPI !== 'undefined') {
    const token = BlogAPI.getToken();
    if (!token) {
      redirectToAdmin('index.html');
      return;
    }
    try {
      await BlogAPI.verifyToken();
      return;
    } catch {
      clearSession();
      redirectToAdmin('index.html');
      return;
    }
  }

  if (!isSessionValid()) {
    redirectToAdmin('index.html');
  } else {
    refreshSession();
  }
}

// ── Init auth mode ──────────────────────────────────────────────
async function initAuthMode() {
  if (typeof BlogAPI === 'undefined') {
    _authMode = 'local';
    return;
  }

  try {
    const online = await BlogAPI.checkHealth();
    if (!online) {
      _authMode = 'local';
      return;
    }

    _authMode = 'api';
    const status = await BlogAPI.setupStatus();
    _apiNeedsSetup = status.needsSetup;
  } catch {
    _authMode = 'local';
  }
}

// ── Login handler ─────────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();

  const pwInput    = document.getElementById('password');
  const loginBtn   = document.getElementById('login-btn');
  const attemptsCnt= document.getElementById('attempts-counter');
  const errorEl    = document.getElementById('login-error');

  if (!pwInput || !loginBtn) return;

  if (!isApiAuth() && isLockedOut()) {
    showLockout();
    return;
  }

  const password = pwInput.value;
  if (!password) {
    showFieldError(pwInput, errorEl, 'Password is required.');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner"></span> Authenticating…';
  clearError(pwInput, errorEl);

  await new Promise(r => setTimeout(r, 400));

  try {
    if (isApiAuth()) {
      await BlogAPI.login(password);
      loginBtn.innerHTML = '✅ Access Granted';
      setTimeout(() => { redirectToAdmin('dashboard.html'); }, 500);
      return;
    }

    await new Promise(r => setTimeout(r, 400));
    const hash = await sha256(password);
    const storedHash = getPasswordHash();

    if (storedHash && hash === storedHash) {
      clearLockout();
      setSession(generateToken());
      loginBtn.innerHTML = '✅ Access Granted';
      setTimeout(() => { redirectToAdmin('dashboard.html'); }, 600);
    } else {
      throw new Error('Invalid password');
    }
  } catch (err) {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '⚡ Access Terminal';
    pwInput.value = '';

    if (isApiAuth()) {
      const remaining = err.data?.attemptsRemaining;
      showFieldError(pwInput, errorEl, err.message || 'Invalid password.');
      if (attemptsCnt && remaining !== undefined) {
        attemptsCnt.textContent = remaining > 0 ? `${remaining} attempt(s) remaining` : 'Locked out';
      }
      if (err.data?.locked) showLockout();
    } else {
      const attempts = incrementAttempts();
      const remaining = AUTH.MAX_ATTEMPTS - attempts;
      showFieldError(pwInput, errorEl, 'Invalid password.');
      if (attemptsCnt) attemptsCnt.textContent = `${remaining} attempt${remaining === 1 ? '' : 's'} remaining`;
      if (isLockedOut()) showLockout();
    }
  }
}

// ── Setup handler (API + local) ───────────────────────────────
async function handleSetup(event) {
  event.preventDefault();
  const pw   = document.getElementById('setup-password')?.value;
  const conf = document.getElementById('setup-confirm')?.value;
  const err  = document.getElementById('setup-error');
  const btn  = document.getElementById('setup-btn');

  if (pw !== conf) { if (err) err.style.display = 'flex'; return; }
  if (err) err.style.display = 'none';

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Setting up…';

  try {
    if (isApiAuth()) {
      await BlogAPI.setup(pw);
    } else {
      await new Promise(r => setTimeout(r, 600));
      const hash = await sha256(pw);
      savePasswordHash(hash);
      clearLockout();
      setSession(generateToken());
    }

    btn.innerHTML = '✅ Password Set!';
    setTimeout(() => { redirectToAdmin('dashboard.html'); }, 700);
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '⚡ Create Password & Enter';
    Toast?.error(e.message || 'Setup failed');
  }
}

function showLockout() {
  const lockoutMsg = document.getElementById('lockout-msg');
  const pwInput    = document.getElementById('password');
  const loginBtn   = document.getElementById('login-btn');
  const attemptsCnt= document.getElementById('attempts-counter');

  if (lockoutMsg) lockoutMsg.classList.add('show');
  if (pwInput)    pwInput.disabled = true;
  if (loginBtn)   loginBtn.disabled = true;
  if (attemptsCnt) attemptsCnt.textContent = 'Locked out';

  const tick = () => {
    const remaining = getRemainingLockoutMs();
    if (remaining <= 0) {
      clearLockout();
      if (lockoutMsg) lockoutMsg.classList.remove('show');
      if (pwInput)    pwInput.disabled = false;
      if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = '⚡ Access Terminal'; }
      if (attemptsCnt) attemptsCnt.textContent = '';
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    if (lockoutMsg) lockoutMsg.textContent = `🔒 Too many failed attempts. Try again in ${mins}:${secs.toString().padStart(2,'0')}`;
    setTimeout(tick, 1000);
  };
  tick();
}

function showFieldError(input, errorEl, msg) {
  if (input)   input.classList.add('form-input--error');
  if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'flex'; }
}

function clearError(input, errorEl) {
  if (input)   input.classList.remove('form-input--error');
  if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
}

function logout() {
  clearSession();
  redirectToAdmin('index.html');
}

function togglePasswordVisibility(inputId, toggleId) {
  const input  = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);
  if (!input || !toggle) return;
  toggle.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    toggle.textContent = isHidden ? '🙈' : '👁';
  });
}

async function setupLoginPage() {
  await initAuthMode();

  const setupNotice = document.getElementById('setup-notice');
  const setupForm   = document.getElementById('setup-form');
  const loginForm   = document.getElementById('login-form');
  const loading     = document.getElementById('login-loading');

  if (loading) loading.style.display = 'none';

  if (isSessionValid()) {
    redirectToAdmin('dashboard.html');
    return;
  }

  if (isFirstRun()) {
    if (setupNotice) setupNotice.style.display = 'block';
    if (setupForm)   setupForm.style.display = 'block';
    if (loginForm)   loginForm.style.display = 'none';
    setupForm?.addEventListener('submit', handleSetup);
    togglePasswordVisibility('setup-password', 'setup-pw-toggle');
  } else {
    if (setupForm) setupForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
    loginForm?.addEventListener('submit', handleLogin);
    togglePasswordVisibility('password', 'pw-toggle');
    if (!isApiAuth() && isLockedOut()) showLockout();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const setupForm = document.getElementById('setup-form');
  if (form || setupForm) {
    setupLoginPage();
    initMatrix('matrix-canvas');
  }
});
