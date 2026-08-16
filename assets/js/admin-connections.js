/* ============================================================
   Connections Dashboard | admin-connections.js
   Monitor API + MongoDB status
   ============================================================ */

let connectionsPollTimer = null;

function switchViewConnectionsHook(view) {
  if (view === 'connections') renderConnections();
}

async function renderConnections() {
  const grid = document.getElementById('conn-grid');
  const apiCard = document.getElementById('conn-api-detail');
  const dbCard = document.getElementById('conn-db-detail');
  const envCard = document.getElementById('conn-env-detail');
  const logEl = document.getElementById('conn-log');

  if (!grid) return;

  setConnBadge('conn-api-badge', 'checking', 'Checking…');
  setConnBadge('conn-db-badge', 'checking', 'Checking…');
  setConnBadge('conn-mode-badge', PostsDB.mode(), PostsDB.mode() === 'api' ? 'MongoDB API' : 'Local Storage');

  const apiUrl = `${window.BLOG_CONFIG.apiBase}/api/health`;
  if (document.getElementById('conn-api-url')) {
    document.getElementById('conn-api-url').textContent = apiUrl;
  }

  try {
    const start = performance.now();
    const health = await BlogAPI.request('/health');
    const latency = Math.round(performance.now() - start);

    setConnBadge('conn-api-badge', 'online', 'Online');
    setConnBadge('conn-db-badge', health.mongodb?.connected ? 'online' : 'offline',
      health.mongodb?.connected ? 'Connected' : 'Disconnected');

    if (apiCard) {
      apiCard.innerHTML = `
        <div class="conn-row"><span>Status</span><strong class="conn-val--ok">${health.status}</strong></div>
        <div class="conn-row"><span>Latency</span><strong>${latency} ms</strong></div>
        <div class="conn-row"><span>Uptime</span><strong>${formatSeconds(health.uptime)}</strong></div>
        <div class="conn-row"><span>Version</span><strong>${health.version}</strong></div>
        <div class="conn-row"><span>Posts in DB</span><strong>${health.stats?.posts ?? '—'}</strong></div>
        <div class="conn-row"><span>Last Check</span><strong>${new Date().toLocaleTimeString()}</strong></div>
      `;
    }

    if (dbCard) {
      const db = health.mongodb || {};
      dbCard.innerHTML = `
        <div class="conn-row"><span>Status</span><strong class="${db.connected ? 'conn-val--ok' : 'conn-val--err'}">${db.status}</strong></div>
        <div class="conn-row"><span>Host</span><strong>${db.host || '—'}</strong></div>
        <div class="conn-row"><span>Database</span><strong>${db.database || '—'}</strong></div>
        <div class="conn-row"><span>Ready State</span><strong>${db.readyState} (${readyStateLabel(db.readyState)})</strong></div>
        <div class="conn-row"><span>Last Connected</span><strong>${db.lastConnected ? new Date(db.lastConnected).toLocaleString() : '—'}</strong></div>
        ${db.lastError ? `<div class="conn-row conn-row--error"><span>Last Error</span><strong>${escapeHtmlConn(db.lastError)}</strong></div>` : ''}
      `;
    }

    // Detailed status (auth required)
    if (BlogAPI.getToken()) {
      try {
        const status = await BlogAPI.getStatus();
        if (envCard) {
          envCard.innerHTML = `
            <div class="conn-row"><span>Environment</span><strong>${status.api?.environment}</strong></div>
            <div class="conn-row"><span>Node.js</span><strong>${status.api?.nodeVersion}</strong></div>
            <div class="conn-row"><span>Memory (heap)</span><strong>${status.api?.memory?.heapUsed} / ${status.api?.memory?.heapTotal}</strong></div>
            <div class="conn-row"><span>Published</span><strong>${status.database?.published}</strong></div>
            <div class="conn-row"><span>Drafts</span><strong>${status.database?.drafts}</strong></div>
            <div class="conn-row"><span>Admin Configured</span><strong>${status.database?.adminConfigured ? 'Yes' : 'No'}</strong></div>
            <div class="conn-row"><span>CORS Origins</span><strong style="font-size:0.75rem;word-break:break-all">${(status.cors?.origins || []).join(', ') || '—'}</strong></div>
            <div class="conn-row"><span>Collections</span><strong>${(status.mongodb?.collections || []).join(', ') || '—'}</strong></div>
          `;
        }
      } catch {
        if (envCard) envCard.innerHTML = '<p class="conn-hint">Log in via API to view server details.</p>';
      }
    }

    appendConnLog(logEl, 'success', `Health check OK — API ${latency}ms, MongoDB ${health.mongodb?.connected ? 'connected' : 'offline'}`);
  } catch (err) {
    setConnBadge('conn-api-badge', 'offline', 'Offline');
    setConnBadge('conn-db-badge', 'offline', 'Unavailable');

    if (apiCard) {
      apiCard.innerHTML = `
        <div class="conn-row conn-row--error"><span>Error</span><strong>${escapeHtmlConn(err.message)}</strong></div>
        <div class="conn-row"><span>API URL</span><strong style="font-size:0.75rem;word-break:break-all">${apiUrl}</strong></div>
        <div class="conn-row"><span>Fallback</span><strong>Using localStorage</strong></div>
      `;
    }
    if (dbCard) {
      dbCard.innerHTML = '<p class="conn-hint">Start the backend and set MONGODB_URI to connect.</p>';
    }

    appendConnLog(logEl, 'error', `Connection failed: ${err.message}`);
  }
}

function setConnBadge(id, state, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `conn-badge conn-badge--${state}`;
  el.textContent = text;
}

function readyStateLabel(n) {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][n] || 'unknown';
}

function formatSeconds(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function escapeHtmlConn(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function appendConnLog(el, type, msg) {
  if (!el) return;
  const line = document.createElement('div');
  line.className = `conn-log__line conn-log__line--${type}`;
  line.innerHTML = `<span class="conn-log__time">${new Date().toLocaleTimeString()}</span> ${escapeHtmlConn(msg)}`;
  el.prepend(line);
  while (el.children.length > 20) el.lastChild.remove();
}

function initConnectionsPanel() {
  document.getElementById('btn-refresh-conn')?.addEventListener('click', () => renderConnections());
  document.getElementById('btn-test-conn')?.addEventListener('click', async () => {
    Toast.info('Running connection test…');
    await renderConnections();
    Toast.success('Connection test complete');
  });

  document.getElementById('btn-save-api-url')?.addEventListener('click', () => {
    const input = document.getElementById('conn-api-input');
    const url = input?.value.trim();
    if (!url) { Toast.error('Enter an API URL'); return; }
    localStorage.setItem('sw_api_url', url.replace(/\/$/, ''));
    Toast.success('API URL saved. Refreshing…');
    setTimeout(() => location.reload(), 800);
  });

  const saved = localStorage.getItem('sw_api_url');
  const input = document.getElementById('conn-api-input');
  if (input && saved) input.value = saved;
}

function startConnectionsPolling() {
  stopConnectionsPolling();
  connectionsPollTimer = setInterval(() => {
    if (currentView === 'connections') renderConnections();
  }, 30000);
}

function stopConnectionsPolling() {
  if (connectionsPollTimer) clearInterval(connectionsPollTimer);
}
