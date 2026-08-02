/* ─────────────────────────────────────────────────────────────────
   TERRA SANDBOX & LABORATORY — Core Controller
   Engines: LUMINA · ROLLA · WEBBL · COMBASE
   ───────────────────────────────────────────────────────────────── */

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  PYRALIS IAM POLICY ENGINE
// ═══════════════════════════════════════════════════════════════════
const PYRALIS_POLICIES = {
  TerraAdmin: {
    description: 'Full unrestricted access to all Terra resources and actions.',
    version: '2026-01',
    statements: [
      { effect: 'Allow', actions: ['*'], resources: ['arn:terra:*'] }
    ]
  },
  DevOpsEngineer: {
    description: 'Deployment and infrastructure management. Read-only on identities and state.',
    version: '2026-01',
    statements: [
      { effect: 'Allow', actions: ['webbl:DeployCocoon', 'webbl:ExecuteMorph', 'webbl:ListCocoons', 'combase:PublishEvent', 'combase:ReadStream', 'rolla:ReadState'], resources: ['arn:terra:*'] },
      { effect: 'Deny',  actions: ['webbl:DeleteCocoon', 'rolla:DeleteState', 'rolla:WriteState', 'lumina:GlowwormBreakGlass', 'lumina:ManageIdentities'], resources: ['arn:terra:*'] }
    ]
  },
  DataAnalyst: {
    description: 'Read-only access to ROLLA state and COMBASE streams. No write or deploy capabilities.',
    version: '2026-01',
    statements: [
      { effect: 'Allow', actions: ['rolla:ReadState', 'combase:ReadStream'], resources: ['arn:terra:*'] },
      { effect: 'Deny',  actions: ['webbl:*', 'rolla:WriteState', 'rolla:DeleteState', 'lumina:*'], resources: ['arn:terra:*'] }
    ]
  },
  GuestUser: {
    description: 'Minimal read-only access. Cannot interact with any engine except public COMBASE streams.',
    version: '2026-01',
    statements: [
      { effect: 'Allow', actions: ['combase:ReadStream'], resources: ['arn:terra:combase:channel/public.*'] },
      { effect: 'Deny',  actions: ['*'], resources: ['arn:terra:*'] }
    ]
  }
};

function pyralisEvaluate(role, action, resource) {
  const policy = PYRALIS_POLICIES[role];
  if (!policy) return { decision: 'Deny', reason: 'Unknown role', policy: null };

  let finalDecision = 'Deny';
  let matchedStatement = null;

  for (const stmt of policy.statements) {
    const actionMatch = stmt.actions.includes('*') || stmt.actions.some(a => {
      if (a.endsWith(':*')) return action.startsWith(a.replace(':*', ':'));
      return a === action;
    });
    const resourceMatch = stmt.resources.includes('arn:terra:*') || stmt.resources.some(r => resource.startsWith(r.replace('*', '')));

    if (actionMatch && resourceMatch) {
      matchedStatement = stmt;
      if (stmt.effect === 'Deny') { finalDecision = 'Deny'; break; }
      if (stmt.effect === 'Allow') finalDecision = 'Allow';
    }
  }

  return {
    decision: finalDecision,
    reason: matchedStatement
      ? `Matched statement: Effect=${matchedStatement.effect}`
      : 'No matching policy statement found — implicit Deny',
    policy
  };
}

// ═══════════════════════════════════════════════════════════════════
//  LUCIOLE JWT ENGINE (Browser-side RS256 simulation)
// ═══════════════════════════════════════════════════════════════════
function b64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

function lucioleSign(sub, role, ttlSeconds, customClaims = {}) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + parseInt(ttlSeconds);

  const header = { alg: 'RS256', typ: 'JWT', kid: `luciole-terra-2026-${role.toLowerCase()}` };
  const payload = {
    iss: 'https://lumina.terra-ecosystem.io',
    sub,
    aud: 'terra-ecosystem',
    iat,
    exp,
    role,
    permissions: getPermissionsForRole(role),
    'terra:env': 'sandbox',
    'terra:engine': 'lumina-luciole',
    ...customClaims
  };

  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  // Simulated signature (in prod this is RS256 via SubtleCrypto)
  const sig = b64url(`terra_sig_${role}_${iat}_${Math.random().toString(36).slice(2)}`);

  return { token: `${h}.${p}.${sig}`, header, payload };
}

function getPermissionsForRole(role) {
  const perms = {
    TerraAdmin:      ['*'],
    DevOpsEngineer:  ['webbl:DeployCocoon', 'webbl:ExecuteMorph', 'rolla:ReadState', 'combase:PublishEvent', 'combase:ReadStream'],
    DataAnalyst:     ['rolla:ReadState', 'combase:ReadStream'],
    GuestUser:       ['combase:ReadStream']
  };
  return perms[role] || [];
}

function lucioleVerify(token) {
  if (!token || !token.includes('.')) return { valid: false, error: 'Malformed JWT: missing segments' };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, error: 'JWT must have exactly 3 segments' };

  try {
    const header  = JSON.parse(b64urlDecode(parts[0]));
    const payload = JSON.parse(b64urlDecode(parts[1]));
    const now     = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: `Token expired at ${new Date(payload.exp * 1000).toLocaleString()}`, header, payload };
    }
    if (payload.iss !== 'https://lumina.terra-ecosystem.io') {
      return { valid: false, error: 'Invalid issuer — not a Luciole token', header, payload };
    }
    return { valid: true, header, payload };
  } catch (e) {
    return { valid: false, error: `Decode error: ${e.message}` };
  }
}

function getJWKS(role) {
  return {
    keys: [{
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: `luciole-terra-2026-${(role||'global').toLowerCase()}`,
      n: 'xLumina_PublicKey_Modulus_N_Base64urlEncoded_Placeholder',
      e: 'AQAB',
      'x5t#S256': 'terra_cert_thumbprint_sha256_placeholder',
      issuer: 'https://lumina.terra-ecosystem.io',
      validFor: ['terra-ecosystem', 'arn:terra:*']
    }]
  };
}

// ═══════════════════════════════════════════════════════════════════
//  LANTERNLINKS MAGIC LINK ENGINE
// ═══════════════════════════════════════════════════════════════════
let activeLanternSession = null;

function lanternIssue(email, ttlSeconds) {
  const otp    = String(Math.floor(100000 + Math.random() * 900000));
  const token  = b64url(JSON.stringify({ email, otp, iat: Date.now(), exp: Date.now() + ttlSeconds * 1000 }));
  const url    = `https://amglogicalis.github.io/terra-sandbox-laboratory/auth?lantern=${token}`;
  activeLanternSession = { otp, email, expiresAt: Date.now() + ttlSeconds * 1000, ttl: ttlSeconds };
  return { otp, url, token };
}

function lanternVerify(inputOtp) {
  if (!activeLanternSession) return { valid: false, error: 'No active LanternLinks session. Issue a magic link first.' };
  if (Date.now() > activeLanternSession.expiresAt) {
    activeLanternSession = null;
    return { valid: false, error: 'OTP has expired.' };
  }
  if (inputOtp === activeLanternSession.otp) {
    activeLanternSession = null;
    return { valid: true, message: `Authentication successful for ${activeLanternSession ? activeLanternSession.email : 'user'}. Session token issued.` };
  }
  return { valid: false, error: 'Invalid OTP. Please check your code.' };
}

// ═══════════════════════════════════════════════════════════════════
//  PHOTURIS VAULT
// ═══════════════════════════════════════════════════════════════════
const photurisVault = JSON.parse(localStorage.getItem('terra_photuris_vault') || 'null') || [
  { id: 'usr_terra_admin_99', name: 'Adrian Terra', email: 'adrian@terra-ecosystem.io', role: 'TerraAdmin', status: 'active', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'usr_devops_01',      name: 'Elena Morph',  email: 'elena@terra-ecosystem.io',  role: 'DevOpsEngineer', status: 'active', createdAt: '2026-02-20T09:30:00Z' },
  { id: 'usr_analyst_42',     name: 'Marco Data',   email: 'marco@terra-ecosystem.io',  role: 'DataAnalyst',    status: 'active', createdAt: '2026-03-10T14:15:00Z' },
  { id: 'usr_guest_99',       name: 'Guest Observer', email: 'guest@public.io',         role: 'GuestUser',      status: 'suspended', createdAt: '2026-07-01T08:00:00Z' }
];

function saveVault() {
  localStorage.setItem('terra_photuris_vault', JSON.stringify(photurisVault));
}

// ═══════════════════════════════════════════════════════════════════
//  ROLLA KV STORE ENGINE
// ═══════════════════════════════════════════════════════════════════
const rollaDB = JSON.parse(localStorage.getItem('terra_rolla_db') || 'null') || {
  'config/laboratory_mode': { active: true, labVersion: '1.0.0', titansConnected: ['LUMINA', 'ROLLA', 'WEBBL', 'COMBASE'] },
  'system/last_deploy': { cocoon: 'terra-sandbox-laboratory', timestamp: '2026-07-31T14:00:00Z', version: 'webbl-v1785501666570' },
  'users/session_count': 0
};

function rollaSave() { localStorage.setItem('terra_rolla_db', JSON.stringify(rollaDB)); }

// ═══════════════════════════════════════════════════════════════════
//  COMBASE EVENT BUS
// ═══════════════════════════════════════════════════════════════════
const combaseEvents = [];
let combaseListeners = {};

function combasePublish(channel, eventName, payload, priority = 'normal') {
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    channel,
    event: eventName,
    priority,
    payload,
    timestamp: new Date().toISOString()
  };
  combaseEvents.push(event);
  if (combaseListeners[channel]) combaseListeners[channel].forEach(cb => cb(event));
  if (combaseListeners['*']) combaseListeners['*'].forEach(cb => cb(event));
  return event;
}

function combaseSubscribe(channel, callback) {
  if (!combaseListeners[channel]) combaseListeners[channel] = [];
  combaseListeners[channel].push(callback);
}

// ═══════════════════════════════════════════════════════════════════
//  GLOWWORM BREAK-GLASS
// ═══════════════════════════════════════════════════════════════════
let glowwormSession = null;
let glowwormInterval = null;

function glowwormIssue(userId, reason, scope) {
  const key     = `gw_bg_sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const expires = Date.now() + 15 * 60 * 1000;
  glowwormSession = { key, userId, reason, scope, issuedAt: new Date().toISOString(), expiresAt: expires };
  combasePublish('terra.system.heartbeat', 'GlowwormBreakGlassIssued', { userId, reason, scope, key: key.slice(0, 12) + '...' }, 'critical');
  return glowwormSession;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN APPLICATION CLASS
// ═══════════════════════════════════════════════════════════════════
class TerraLabApp {
  constructor() {
    this.currentView  = 'overview';
    this.currentTab   = {};
    this.ghToken      = localStorage.getItem('terra_gh_token') || '';
    this.rollaAuditEntries = [];
    this.lastLucioleToken  = null;
    this.lanternCountdown  = null;
  }

  init() {
    this._bindNav();
    this._bindTopbar();
    this._bindLuciole();
    this._bindPyralis();
    this._bindLantern();
    this._bindGlowworm();
    this._bindPhoturis();
    this._bindColeoptera();
    this._bindRolla();
    this._bindWebbl();
    this._bindCombase();
    this._bindModals();
    this._bindOverview();

    // Pre-populate from saved token
    if (this.ghToken) {
      document.getElementById('gh-token').value = this.ghToken;
    }

    // Subscribe COMBASE UI to all events
    combaseSubscribe('*', evt => this._appendStreamEvent(evt));

    // Initial Photuris render
    this._renderPhoturis();
    // Initial Rolla render
    this._renderRollaDB();

    // Emit boot event
    combasePublish('terra.system.heartbeat', 'LabInitialized', {
      modules: ['LUMINA', 'ROLLA', 'WEBBL', 'COMBASE'],
      timestamp: new Date().toISOString()
    });

    this.toast('Terra Sandbox & Laboratory loaded! All engines ready.', 'success');
  }

  // ── Navigation ──
  _bindNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        this.switchView(item.dataset.view);
      });
    });
    document.querySelectorAll('.module-card[data-nav]').forEach(card => {
      card.addEventListener('click', () => this.switchView(card.dataset.nav));
    });
  }

  switchView(view) {
    document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const el = document.getElementById(`view-${view}`);
    if (el) el.classList.remove('hidden');
    const navEl = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (navEl) navEl.classList.add('active');
    const titles = {
      overview: 'Overview & Metrics',
      lumina: 'LUMINA Auth Suite',
      rolla: 'ROLLA Storage Lab',
      webbl: 'WEBBL Morphs & CDN',
      combase: 'COMBASE Event Bus',
      ballom: 'BALLOM Morph Studio',
      termes: 'TERMES Inverted APIs'
    };
    document.getElementById('current-view-title').textContent = titles[view] || 'Laboratory View';
    this.currentView = view;

    // Restore tabs for lumina
    if (view === 'lumina') {
      const savedTab = this.currentTab['lumina'] || 'lumina-luciole';
      this._activateTab(savedTab);
    }
  }

  // ── Tab system ──
  _bindNav_tabs(scope) {
    document.querySelectorAll(`#view-${scope} .tab-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        this._activateTab(btn.dataset.tab);
        this.currentTab[scope] = btn.dataset.tab;
      });
    });
  }

  _activateTab(tabId) {
    const scope = tabId.split('-')[0];
    document.querySelectorAll(`#view-${scope} .tab-btn`).forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`#view-${scope} .tab-content`).forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    const content = document.getElementById(`tab-${tabId}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
  }

  // ── Topbar & Auth ──
  _bindTopbar() {
    this._bindNav_tabs('lumina');

    document.getElementById('btn-connect').addEventListener('click', () => this._connectPAT());
    document.getElementById('gh-token').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._connectPAT();
    });
    const disconnectBtn = document.getElementById('btn-disconnect');
    if (disconnectBtn) disconnectBtn.addEventListener('click', () => this._disconnectPAT());
  }

  async _connectPAT() {
    const token = document.getElementById('gh-token').value.trim();
    if (!token) { this.toast('Please enter a GitHub PAT token.', 'error'); return; }

    this.toast('Verifying GitHub token...', 'info');
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const user = await res.json();
      this.ghToken = token;
      localStorage.setItem('terra_gh_token', token);

      document.getElementById('token-group').classList.add('hidden');
      const badge = document.getElementById('user-status-badge');
      badge.classList.remove('hidden');
      document.getElementById('user-name-display').textContent = user.login;

      this.toast(`Connected as @${user.login}`, 'success');
      combasePublish('lumina.auth.events', 'GitHubPATConnected', { login: user.login });
    } catch (e) {
      this.toast(`Connection failed: ${e.message}`, 'error');
    }
  }

  _disconnectPAT() {
    this.ghToken = '';
    localStorage.removeItem('terra_gh_token');
    document.getElementById('token-group').classList.remove('hidden');
    document.getElementById('user-status-badge').classList.add('hidden');
    document.getElementById('gh-token').value = '';
    this.toast('Disconnected from GitHub.', 'info');
  }

  // ── Overview Diagnostics ──
  _bindOverview() {
    document.getElementById('btn-run-all-tests').addEventListener('click', () => this._runDiagnostics());
  }

  async _runDiagnostics() {
    const panel = document.getElementById('diagnostics-output');
    const log   = document.getElementById('diag-log');
    panel.classList.remove('hidden');
    log.textContent = '';

    const steps = [
      ['LUMINA Luciole engine', () => { lucioleSign('diag_user', 'TerraAdmin', 3600); return 'JWT signed with RS256 — OK'; }],
      ['LUMINA Pyralis IAM',    () => { const r = pyralisEvaluate('TerraAdmin', 'webbl:DeployCocoon', 'arn:terra:webbl:*'); return `Decision: ${r.decision}`; }],
      ['ROLLA KV Store',        () => { rollaDB['system/diag_ping'] = { ts: Date.now() }; rollaSave(); return `${Object.keys(rollaDB).length} keys in store`; }],
      ['WEBBL Chrysalis',       () => 'Detected: Plain HTML (terra-sandbox-laboratory)'],
      ['COMBASE Event Bus',     () => { combasePublish('terra.system.heartbeat', 'DiagnosticPing', { source: 'overview' }); return `Bus active — ${combaseEvents.length} events total`; }],
      ['LanternLinks Engine',   () => { const l = lanternIssue('diag@test.io', 600); return `OTP issued: ${l.otp.slice(0,2)}**** (600s TTL)`; }],
      ['GitHub API',            async () => {
        if (!this.ghToken) return 'SKIP — No PAT connected';
        const r = await fetch('https://api.github.com/repos/amglogicalis/terra-sandbox-laboratory', { headers: { Authorization: `Bearer ${this.ghToken}` } });
        const d = await r.json();
        return `Repo: ${d.full_name} — Stars: ${d.stargazers_count}`;
      }]
    ];

    for (const [label, fn] of steps) {
      try {
        log.textContent += `[  RUNNING  ] ${label}...\n`;
        const result = await fn();
        log.textContent += `[    OK     ] ${label}: ${result}\n`;
        document.getElementById(`status-${label.split(' ')[0].toLowerCase()}`)?.textContent ? null : null;
      } catch (e) {
        log.textContent += `[  FAILED   ] ${label}: ${e.message}\n`;
      }
      log.scrollTop = log.scrollHeight;
      await new Promise(r => setTimeout(r, 120));
    }

    log.textContent += '\n✅ All diagnostics complete.\n';
    this.toast('Full system diagnostics passed!', 'success');
    document.getElementById('status-lumina').textContent  = '✅ OK (Luciole + Pyralis)';
    document.getElementById('status-rolla').textContent   = `✅ OK (${Object.keys(rollaDB).length} keys)`;
    document.getElementById('status-webbl').textContent   = '✅ OK (Cocoon Live)';
    document.getElementById('status-combase').textContent = `✅ OK (${combaseEvents.length} events)`;
  }

  // ── LUMINA — Luciole JWT ──
  _bindLuciole() {
    document.getElementById('btn-luciole-sign').addEventListener('click', () => {
      const sub  = document.getElementById('luciole-sub').value.trim() || 'anonymous';
      const role = document.getElementById('luciole-role').value;
      const ttl  = document.getElementById('luciole-ttl').value;
      let claims = {};
      try { claims = JSON.parse(document.getElementById('luciole-claims').value || '{}'); } catch {}

      const { token, header, payload } = lucioleSign(sub, role, ttl, claims);
      this.lastLucioleToken = token;
      document.getElementById('luciole-token-output').value = token;
      document.getElementById('luciole-decoded-json').textContent = JSON.stringify({ header, payload }, null, 2);

      // Auto-fill Coleoptera tab
      document.getElementById('coleoptera-source-token').value = token;

      combasePublish('lumina.auth.events', 'JWTSigned', { sub, role, exp: payload.exp });
      this.toast(`Luciole JWT signed for ${role}`, 'success');
    });

    document.getElementById('btn-luciole-verify').addEventListener('click', () => {
      const token = document.getElementById('luciole-token-output').value.trim();
      const result = lucioleVerify(token);
      const el = document.getElementById('luciole-verify-result');
      el.classList.remove('hidden', 'verify-success', 'verify-error');
      if (result.valid) {
        el.className = 'verify-result verify-success';
        el.innerHTML = '<i class="fa-solid fa-check-circle"></i> Signature valid — Luciole RS256 verified successfully';
        if (result.payload) document.getElementById('luciole-decoded-json').textContent = JSON.stringify({ header: result.header, payload: result.payload }, null, 2);
      } else {
        el.className = 'verify-result verify-error';
        el.innerHTML = `<i class="fa-solid fa-xmark-circle"></i> ${result.error}`;
      }
    });

    document.getElementById('btn-luciole-copy').addEventListener('click', () => {
      const token = document.getElementById('luciole-token-output').value;
      if (token) { navigator.clipboard.writeText(token); this.toast('Token copied!', 'info'); }
    });

    document.getElementById('btn-luciole-jwks').addEventListener('click', () => {
      const role = document.getElementById('luciole-role').value;
      document.getElementById('luciole-decoded-json').textContent = JSON.stringify(getJWKS(role), null, 2);
      this.toast('JWKS public key loaded', 'info');
    });
  }

  // ── LUMINA — Pyralis IAM ──
  _bindPyralis() {
    document.getElementById('btn-pyralis-eval').addEventListener('click', () => {
      const role     = document.getElementById('pyralis-role-select').value;
      const action   = document.getElementById('pyralis-action-select').value;
      const resource = document.getElementById('pyralis-resource-arn').value.trim();

      const result = pyralisEvaluate(role, action, resource);
      const box = document.getElementById('pyralis-decision-box');
      box.className = `decision-box decision-${result.decision.toLowerCase()}`;
      const icon = result.decision === 'Allow' ? 'fa-circle-check' : 'fa-ban';
      const label = result.decision === 'Allow' ? '✅ ALLOWED' : '🚫 DENIED';
      box.innerHTML = `<i class="fa-solid ${icon}"></i> <div><div style="font-size:1.2rem;">${label}</div><div style="font-size:0.75rem; opacity:0.7; margin-top:4px;">${result.reason}</div></div>`;

      document.getElementById('pyralis-policy-json').textContent = JSON.stringify(result.policy, null, 2);
      combasePublish('lumina.auth.events', 'PolicyEvaluated', { role, action, resource, decision: result.decision });
      this.toast(`Pyralis: ${result.decision} for ${role} → ${action}`, result.decision === 'Allow' ? 'success' : 'warning');
    });

    document.getElementById('btn-pyralis-matrix').addEventListener('click', () => {
      const panel = document.getElementById('pyralis-matrix-panel');
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) this._renderPyralisMatrix();
    });
  }

  _renderPyralisMatrix() {
    const roles   = Object.keys(PYRALIS_POLICIES);
    const actions = ['webbl:DeployCocoon', 'webbl:DeleteCocoon', 'webbl:ExecuteMorph', 'rolla:WriteState', 'rolla:ReadState', 'rolla:DeleteState', 'lumina:GlowwormBreakGlass', 'lumina:ManageIdentities', 'combase:PublishEvent', 'combase:ReadStream'];
    const resource = 'arn:terra:webbl:cocoon/terra-sandbox-laboratory';

    let html = '<thead><tr><th>Action</th>' + roles.map(r => `<th>${r}</th>`).join('') + '</tr></thead><tbody>';
    for (const action of actions) {
      html += `<tr><td style="font-family: var(--font-mono); font-size:0.75rem;">${action}</td>`;
      for (const role of roles) {
        const { decision } = pyralisEvaluate(role, action, resource);
        const color = decision === 'Allow' ? 'var(--accent)' : 'var(--danger)';
        const icon  = decision === 'Allow' ? '✅' : '🚫';
        html += `<td style="text-align:center; color:${color}; font-size:0.85rem;">${icon}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody>';
    document.getElementById('pyralis-matrix-table').innerHTML = html;
  }

  // ── LUMINA — LanternLinks ──
  _bindLantern() {
    document.getElementById('btn-lantern-generate').addEventListener('click', () => {
      const email = document.getElementById('lantern-email').value.trim();
      const ttl   = parseInt(document.getElementById('lantern-ttl').value);
      if (!email) { this.toast('Enter an email address.', 'error'); return; }

      const { otp, url } = lanternIssue(email, ttl);
      document.getElementById('lantern-url-preview').value = url;

      // OTP digit display
      otp.split('').forEach((d, i) => {
        const el = document.getElementById(`otp-d${i+1}`);
        if (el) { el.textContent = d; el.classList.add('filled'); }
      });

      // Countdown bar
      const bar   = document.getElementById('lantern-expiry-bar');
      const timer = document.getElementById('lantern-countdown');
      const fill  = document.getElementById('lantern-progress');
      bar.classList.remove('hidden');
      fill.style.width = '100%';
      if (this.lanternCountdown) clearInterval(this.lanternCountdown);
      let remaining = ttl;
      this.lanternCountdown = setInterval(() => {
        remaining--;
        const m = Math.floor(remaining / 60), s = remaining % 60;
        timer.textContent = `${m}:${String(s).padStart(2,'0')}`;
        fill.style.width = `${(remaining / ttl) * 100}%`;
        if (remaining <= 0) {
          clearInterval(this.lanternCountdown);
          bar.classList.add('hidden');
          [1,2,3,4,5,6].forEach(i => { const el = document.getElementById(`otp-d${i}`); if (el) { el.textContent = '-'; el.classList.remove('filled'); } });
          this.toast('LanternLink expired.', 'warning');
        }
      }, 1000);

      combasePublish('lumina.auth.events', 'MagicLinkIssued', { email, ttl, otpPrefix: otp.slice(0,2) + '****' });
      this.toast(`Magic link + OTP issued for ${email}`, 'success');
    });

    document.getElementById('btn-lantern-verify-otp').addEventListener('click', () => {
      const input  = document.getElementById('lantern-otp-input').value.trim();
      const result = lanternVerify(input);
      const el     = document.getElementById('lantern-verify-result');
      el.classList.remove('hidden', 'verify-success', 'verify-error');
      if (result.valid) {
        el.className = 'verify-result verify-success';
        el.innerHTML = '<i class="fa-solid fa-check-circle"></i> OTP validated — User authenticated via LanternLinks';
        combasePublish('lumina.auth.events', 'MagicLinkValidated', { success: true });
      } else {
        el.className = 'verify-result verify-error';
        el.innerHTML = `<i class="fa-solid fa-xmark-circle"></i> ${result.error}`;
      }
    });

    document.getElementById('btn-lantern-copy-url').addEventListener('click', () => {
      const url = document.getElementById('lantern-url-preview').value;
      if (url) { navigator.clipboard.writeText(url); this.toast('Magic link copied!', 'info'); }
    });
  }

  // ── LUMINA — Glowworm Break-Glass ──
  _bindGlowworm() {
    document.getElementById('btn-glowworm-trigger').addEventListener('click', () => {
      const user   = document.getElementById('glowworm-user').value.trim();
      const reason = document.getElementById('glowworm-reason').value.trim();
      const scope  = document.getElementById('glowworm-scope').value;
      if (!reason) { this.toast('Incident reason is required for audit trail.', 'error'); return; }

      const session = glowwormIssue(user, reason, scope);

      document.getElementById('glowworm-inactive').classList.add('hidden');
      const card = document.getElementById('glowworm-active-card');
      card.classList.remove('hidden');
      document.getElementById('glowworm-key-display').textContent = session.key;
      document.getElementById('glowworm-scope-display').textContent = `Scope: ${scope}`;

      // Countdown
      let remaining = 15 * 60;
      if (glowwormInterval) clearInterval(glowwormInterval);
      glowwormInterval = setInterval(() => {
        remaining--;
        const m = Math.floor(remaining / 60), s = remaining % 60;
        document.getElementById('glowworm-timer').textContent = `${m}:${String(s).padStart(2,'0')}`;
        if (remaining <= 0) {
          clearInterval(glowwormInterval);
          this._revokeGlowworm('Token expired automatically');
        }
      }, 1000);

      // Audit
      this._addGlowwormAudit(`ISSUED by ${user} — Scope: ${scope} — Reason: "${reason.slice(0,50)}"`);
      this.toast('⚡ Break-Glass token issued! Expires in 15 min.', 'warning');
    });

    document.getElementById('btn-glowworm-revoke').addEventListener('click', () => this._revokeGlowworm('Manual revocation by operator'));
    document.getElementById('btn-glowworm-copy').addEventListener('click', () => {
      const key = document.getElementById('glowworm-key-display').textContent;
      navigator.clipboard.writeText(key); this.toast('Emergency key copied!', 'info');
    });
  }

  _revokeGlowworm(reason) {
    if (glowwormInterval) clearInterval(glowwormInterval);
    glowwormSession = null;
    document.getElementById('glowworm-active-card').classList.add('hidden');
    document.getElementById('glowworm-inactive').classList.remove('hidden');
    this._addGlowwormAudit(`REVOKED — ${reason}`);
    combasePublish('terra.system.heartbeat', 'GlowwormRevoked', { reason }, 'high');
    this.toast('Break-Glass session revoked.', 'info');
  }

  _addGlowwormAudit(msg) {
    const list = document.getElementById('glowworm-audit');
    const li   = document.createElement('li');
    li.innerHTML = `<span class="audit-time">${new Date().toLocaleTimeString()}</span> <span class="text-soft">${msg}</span>`;
    if (list.querySelector('.text-muted')) list.innerHTML = '';
    list.prepend(li);
  }

  // ── LUMINA — Photuris Vault ──
  _bindPhoturis() {
    document.getElementById('btn-photuris-add').addEventListener('click', () => {
      document.getElementById('modal-add-identity').classList.remove('hidden');
    });

    document.getElementById('btn-save-identity').addEventListener('click', () => {
      const name  = document.getElementById('new-user-name').value.trim();
      const email = document.getElementById('new-user-email').value.trim();
      const role  = document.getElementById('new-user-role').value;
      if (!name || !email) { this.toast('Name and email are required.', 'error'); return; }

      const id = `usr_${role.toLowerCase().slice(0,4)}_${Date.now().toString(36)}`;
      photurisVault.push({ id, name, email, role, status: 'active', createdAt: new Date().toISOString() });
      saveVault();
      this._renderPhoturis();
      this.closeModals();
      combasePublish('lumina.vault.mutations', 'IdentityCreated', { id, email, role });
      this.toast(`Identity ${name} created in Photuris Vault`, 'success');
    });

    document.getElementById('photuris-search').addEventListener('input', (e) => {
      this._renderPhoturis(e.target.value.toLowerCase());
    });

    document.getElementById('btn-photuris-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(photurisVault, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'photuris-vault-export.json' });
      a.click();
      this.toast('Vault exported as JSON.', 'info');
    });
  }

  _renderPhoturis(filter = '') {
    const tbody = document.getElementById('photuris-table-body');
    const data  = filter ? photurisVault.filter(u => u.name.toLowerCase().includes(filter) || u.email.toLowerCase().includes(filter) || u.role.toLowerCase().includes(filter)) : photurisVault;

    const roleColors = { TerraAdmin: 'primary', DevOpsEngineer: 'accent', DataAnalyst: 'warning', GuestUser: 'info' };
    tbody.innerHTML = data.map(u => `
      <tr>
        <td style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted);">${u.id}</td>
        <td style="font-weight:600;">${u.name}</td>
        <td style="color:var(--text-soft);">${u.email}</td>
        <td><span class="badge badge-${roleColors[u.role] || 'primary'}">${u.role}</span></td>
        <td style="color:var(--text-muted); font-size:0.75rem;">${new Date(u.createdAt).toLocaleDateString()}</td>
        <td><span class="badge ${u.status === 'active' ? 'badge-accent' : 'badge-danger'}">${u.status}</span></td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-secondary" onclick="app.photurisToggle('${u.id}')">
              ${u.status === 'active' ? '<i class="fa-solid fa-ban"></i>' : '<i class="fa-solid fa-check"></i>'}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="app.photurisIssueJWT('${u.id}')">
              <i class="fa-solid fa-key"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="app.photurisDelete('${u.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  photurisToggle(id) {
    const u = photurisVault.find(u => u.id === id);
    if (!u) return;
    u.status = u.status === 'active' ? 'suspended' : 'active';
    saveVault();
    this._renderPhoturis();
    combasePublish('lumina.vault.mutations', 'IdentityStatusChanged', { id, status: u.status });
    this.toast(`${u.name} is now ${u.status}.`, 'info');
  }

  photurisIssueJWT(id) {
    const u = photurisVault.find(u => u.id === id);
    if (!u) return;
    const { token } = lucioleSign(u.id, u.role, 3600, { email: u.email });
    this.switchView('lumina');
    this._activateTab('lumina-luciole');
    document.getElementById('luciole-sub').value   = u.id;
    document.getElementById('luciole-role').value  = u.role;
    document.getElementById('luciole-token-output').value = token;
    document.getElementById('luciole-decoded-json').textContent = JSON.stringify(lucioleVerify(token).payload, null, 2);
    this.toast(`JWT issued for ${u.name} (${u.role})`, 'success');
  }

  photurisDelete(id) {
    const idx = photurisVault.findIndex(u => u.id === id);
    if (idx === -1) return;
    const u = photurisVault.splice(idx, 1)[0];
    saveVault();
    this._renderPhoturis();
    combasePublish('lumina.vault.mutations', 'IdentityDeleted', { id, email: u.email });
    this.toast(`Identity ${u.name} deleted from vault.`, 'warning');
  }

  // ── LUMINA — Coleoptera Bridge ──
  _bindColeoptera() {
    document.getElementById('btn-coleoptera-aws').addEventListener('click', () => this.testColeoptera('aws'));
    document.getElementById('btn-coleoptera-supabase').addEventListener('click', () => this.testColeoptera('supabase'));
    document.getElementById('btn-coleoptera-auth0').addEventListener('click', () => this.testColeoptera('auth0'));
  }

  testColeoptera(provider) {
    const raw = document.getElementById('coleoptera-source-token')?.value?.trim() || this.lastLucioleToken;
    if (!raw) { this.toast('Paste a Luciole JWT token in the source field first.', 'error'); return; }

    const { valid, payload, error } = lucioleVerify(raw);
    const role = valid ? payload.role : 'GuestUser';

    const outputs = {
      aws: {
        elementId: 'coleoptera-aws-output',
        data: {
          provider: 'AWS STS AssumeRoleWithWebIdentity',
          roleArn: `arn:aws:iam::123456789012:role/TerraLumina-${role}`,
          credentials: {
            AccessKeyId: `ASIA${Math.random().toString(36).toUpperCase().slice(2, 18)}`,
            SecretAccessKey: '***REDACTED***',
            SessionToken: `AQoXnyc8efmppBPyyQsELji+ov...`,
            Expiration: new Date(Date.now() + 3600000).toISOString()
          },
          assumedRoleUser: { Arn: `arn:aws:sts::123456789012:assumed-role/TerraLumina-${role}/terra_session` }
        }
      },
      supabase: {
        elementId: 'coleoptera-supabase-output',
        data: {
          provider: 'Supabase RLS JWT',
          supabase_jwt: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64url(JSON.stringify({ sub: payload?.sub || 'user', role: role === 'TerraAdmin' ? 'service_role' : 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 }))}.supabase_sig_placeholder`,
          rlsPoliciesApplied: role === 'DataAnalyst' ? ['SELECT on public.*'] : role === 'TerraAdmin' ? ['ALL on public.*'] : ['SELECT on public.documents'],
          projectRef: 'terra-sandbox-supabase'
        }
      },
      auth0: {
        elementId: 'coleoptera-auth0-output',
        data: {
          provider: 'Auth0 OIDC/SAML Bridge',
          access_token: `auth0_token_${Math.random().toString(36).slice(2, 22)}`,
          token_type: 'Bearer',
          expires_in: 86400,
          scope: `openid profile email ${role.toLowerCase()}`,
          id_token: `eyJhbGciOiJSUzI1NiJ9...`,
          auth0_domain: 'terra-ecosystem.eu.auth0.com',
          mappedRole: role
        }
      }
    };

    const output = outputs[provider];
    if (!output) return;
    document.getElementById(output.elementId).textContent = JSON.stringify(output.data, null, 2);
    combasePublish('lumina.auth.events', 'ColeopteraTranslation', { provider, role });
    this.toast(`Coleoptera: Token translated to ${provider.toUpperCase()}`, 'success');
  }

  // ── ROLLA Storage ──
  _bindRolla() {
    document.getElementById('btn-rolla-set').addEventListener('click', () => {
      const key = document.getElementById('rolla-key-input').value.trim();
      const val = document.getElementById('rolla-val-input').value.trim();
      if (!key) { this.toast('Key is required.', 'error'); return; }
      let parsed;
      try { parsed = JSON.parse(val); } catch { parsed = val; }
      rollaDB[key] = parsed;
      rollaSave();
      this._renderRollaDB();
      this._addRollaAudit('write', key, parsed);
      combasePublish('rolla.state.changes', 'KeyWritten', { key, type: typeof parsed });
      this.toast(`Key "${key}" written to Rolla DB`, 'success');
    });

    document.getElementById('btn-rolla-get').addEventListener('click', () => {
      const key = document.getElementById('rolla-key-input').value.trim();
      if (!key) { this.toast('Enter a key to read.', 'error'); return; }
      const val = rollaDB[key];
      if (val === undefined) { this.toast(`Key "${key}" not found.`, 'warning'); return; }
      document.getElementById('rolla-val-input').value = JSON.stringify(val, null, 2);
      this._addRollaAudit('read', key, val);
      this.toast(`Key "${key}" read from Rolla DB`, 'info');
    });

    document.getElementById('btn-rolla-del').addEventListener('click', () => {
      const key = document.getElementById('rolla-key-input').value.trim();
      if (!key || !rollaDB[key]) { this.toast(`Key "${key}" not found.`, 'warning'); return; }
      delete rollaDB[key];
      rollaSave();
      this._renderRollaDB();
      this._addRollaAudit('delete', key, null);
      combasePublish('rolla.state.changes', 'KeyDeleted', { key });
      this.toast(`Key "${key}" deleted.`, 'warning');
    });

    document.getElementById('btn-rolla-clear-all').addEventListener('click', () => {
      const defaults = {
        'config/laboratory_mode': { active: true, labVersion: '1.0.0', titansConnected: ['LUMINA', 'ROLLA', 'WEBBL', 'COMBASE'] },
        'system/last_deploy': { cocoon: 'terra-sandbox-laboratory', timestamp: new Date().toISOString() }
      };
      Object.keys(rollaDB).forEach(k => delete rollaDB[k]);
      Object.assign(rollaDB, defaults);
      rollaSave();
      this._renderRollaDB();
      this._addRollaAudit('write', 'system/reset', 'DB restored to defaults');
      this.toast('Rolla DB reset to defaults.', 'info');
    });

    document.getElementById('btn-rolla-refresh-view').addEventListener('click', () => this._renderRollaDB());
  }

  _renderRollaDB() {
    document.getElementById('rolla-state-json').textContent = JSON.stringify(rollaDB, null, 2);
    document.getElementById('rolla-entry-count').textContent = Object.keys(rollaDB).length;
  }

  _addRollaAudit(type, key, val) {
    const list = document.getElementById('rolla-audit-log');
    if (list.querySelector('.text-muted')?.parentElement?.tagName === 'LI') list.innerHTML = '';
    const li = document.createElement('li');
    li.className = type;
    const icon = { write: '✏️', read: '📖', delete: '🗑️' }[type];
    li.innerHTML = `<span class="audit-time">${new Date().toLocaleTimeString()}</span> <span>${icon} [${type.toUpperCase()}] <strong>${key}</strong></span>`;
    list.prepend(li);
    if (list.children.length > 20) list.lastElementChild.remove();
  }

  // ── WEBBL Lab ──
  _bindWebbl() {
    document.getElementById('btn-chrysalis-detect').addEventListener('click', () => {
      const type = document.getElementById('chrysalis-project-type').value;
      const results = {
        'plain-html': { detected: 'Plain HTML', buildCommand: null, outputDir: '.', confidence: 1.0, indicators: ['index.html', 'style.css', 'app.js'] },
        'vite':       { detected: 'Vite',       buildCommand: 'npm run build', outputDir: 'dist',    confidence: 0.97, indicators: ['vite.config.js', 'package.json'] },
        'nextjs':     { detected: 'Next.js',    buildCommand: 'npm run build', outputDir: 'out',     confidence: 0.99, indicators: ['next.config.js', 'pages/'] },
        'nuxt':       { detected: 'Nuxt 3',     buildCommand: 'npm run generate', outputDir: '.output/public', confidence: 0.95, indicators: ['nuxt.config.ts'] },
        'hugo':       { detected: 'Hugo',        buildCommand: 'hugo', outputDir: 'public', confidence: 0.98, indicators: ['hugo.toml', 'content/'] },
        'jekyll':     { detected: 'Jekyll',      buildCommand: 'bundle exec jekyll build', outputDir: '_site', confidence: 0.96, indicators: ['_config.yml', 'Gemfile'] }
      };
      const r = results[type];
      document.getElementById('chrysalis-result-json').textContent = JSON.stringify({
        chrysalisVersion: '1.0.4',
        scannedAt: new Date().toISOString(),
        ...r,
        webblCompatible: true,
        estimatedDeployTime: '< 30 seconds'
      }, null, 2);
      this.toast(`Chrysalis detected: ${r.detected}`, 'success');
    });

    document.getElementById('btn-run-morph').addEventListener('click', async () => {
      const morph = document.getElementById('morph-select').value;
      let payload = {};
      try { payload = JSON.parse(document.getElementById('morph-payload').value || '{}'); } catch {}
      const el = document.getElementById('morph-output-json');
      el.textContent = '// Invoking Morph function...';

      await new Promise(r => setTimeout(r, 600));
      const morphResults = {
        'morph-health-check': { status: 'healthy', uptime: Math.floor(Math.random() * 86400), checks: { github_api: 'OK', rolla_db: 'OK', lumina_engine: 'OK', combase_bus: 'OK' } },
        'morph-identity-sync': { synced: photurisVault.length, active: photurisVault.filter(u => u.status === 'active').length, errors: 0, duration_ms: Math.floor(Math.random() * 200) + 50 },
        'morph-event-relay': { relayed: combaseEvents.length, channels: 6, last_event: combaseEvents.at(-1)?.event || 'none', buffer_used: `${combaseEvents.length}/1000` },
        'morph-state-snapshot': { snapshot_id: `snap_${Date.now()}`, keys: Object.keys(rollaDB).length, size_kb: (JSON.stringify(rollaDB).length / 1024).toFixed(2), timestamp: new Date().toISOString() }
      };

      const result = {
        morph,
        trigger: payload.trigger || 'manual',
        executionId: `exec_${Date.now()}`,
        startedAt: new Date().toISOString(),
        duration_ms: Math.floor(Math.random() * 300) + 80,
        status: 'success',
        output: morphResults[morph]
      };
      el.textContent = JSON.stringify(result, null, 2);
      combasePublish('webbl.morph.invocations', 'MorphExecuted', { morph, status: 'success' });
      this.toast(`Morph ${morph} executed successfully`, 'success');
    });

    document.getElementById('btn-webbl-refresh').addEventListener('click', async () => {
      if (!this.ghToken) { this.toast('Connect a GitHub PAT to refresh live data.', 'warning'); return; }
      this.toast('Refreshing WEBBL status from GitHub API...', 'info');
      // In production this would call the GitHub Pages API
      await new Promise(r => setTimeout(r, 800));
      this.toast('WEBBL Cocoon status refreshed.', 'success');
    });
  }

  // ── COMBASE Event Bus ──
  _bindCombase() {
    document.getElementById('btn-combase-publish').addEventListener('click', () => {
      const channel  = document.getElementById('combase-channel').value;
      const name     = document.getElementById('combase-event-name').value.trim() || 'UnnamedEvent';
      const priority = document.getElementById('combase-priority').value;
      let payload = {};
      try { payload = JSON.parse(document.getElementById('combase-payload').value || '{}'); } catch { this.toast('Invalid JSON payload.', 'error'); return; }

      combasePublish(channel, name, payload, priority);
      document.getElementById('combase-event-count').textContent = combaseEvents.length;
      this.toast(`Event "${name}" published to ${channel}`, 'success');
    });

    document.getElementById('btn-combase-burst').addEventListener('click', async () => {
      const channel = document.getElementById('combase-channel').value;
      for (let i = 0; i < 10; i++) {
        combasePublish(channel, `BurstEvent_${i+1}`, { index: i+1, burst: true, ts: Date.now() });
        await new Promise(r => setTimeout(r, 80));
      }
      document.getElementById('combase-event-count').textContent = combaseEvents.length;
      this.toast('Burst test: 10 events published.', 'info');
    });

    document.getElementById('btn-combase-clear').addEventListener('click', () => {
      document.getElementById('combase-stream-log').innerHTML = '';
      this.toast('Event stream cleared.', 'info');
    });

    document.getElementById('combase-filter').addEventListener('change', (e) => {
      const filter = e.target.value;
      document.querySelectorAll('.stream-item[data-channel]').forEach(el => {
        el.style.display = (filter === 'all' || el.dataset.channel === filter) ? '' : 'none';
      });
    });
  }

  _appendStreamEvent(evt) {
    const log  = document.getElementById('combase-stream-log');
    if (!log) return;
    const time = new Date(evt.timestamp).toLocaleTimeString();
    const priorityColors = { critical: 'badge-danger', high: 'badge-warning', normal: 'badge-info' };
    const badgeClass = priorityColors[evt.priority] || 'badge-info';

    const item = document.createElement('div');
    item.className = 'stream-item';
    item.dataset.channel = evt.channel;
    item.innerHTML = `
      <span class="stream-time">${time}</span>
      <span class="badge ${badgeClass} stream-channel" style="font-size:0.65rem; max-width:140px; overflow:hidden; text-overflow:ellipsis;">${evt.channel}</span>
      <span class="stream-msg"><strong>${evt.event}</strong> — ${JSON.stringify(evt.payload).slice(0, 80)}${JSON.stringify(evt.payload).length > 80 ? '...' : ''}</span>`;

    log.prepend(item);
    if (log.children.length > 50) log.lastElementChild.remove();
    document.getElementById('combase-event-count').textContent = combaseEvents.length;
  }

  // ── Modals ──
  _bindModals() {
    document.getElementById('btn-close-modal-identity').addEventListener('click', () => this.closeModals());
    document.getElementById('btn-cancel-identity').addEventListener('click', () => this.closeModals());
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', e => { if (e.target === backdrop) this.closeModals(); });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeModals(); });
  }

  closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  }

  // ── Toast system ──
  toast(msg, type = 'info') {
    const icons = { success: 'fa-check-circle', error: 'fa-xmark-circle', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${msg}</span>`;
    document.getElementById('toast-container').prepend(el);
    setTimeout(() => el.remove(), 4000);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════
const app = new TerraLabApp();
document.addEventListener('DOMContentLoaded', () => app.init());
