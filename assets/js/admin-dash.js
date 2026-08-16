/* ============================================================
   Admin Dashboard | admin-dash.js
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let currentView   = 'dashboard';
let editingPostId = null;
let mde           = null;           // EasyMDE instance
let tableSearch   = '';
let tableSortCol  = 'date';
let tableSortDir  = 'desc';
let tablePage     = 1;
const TABLE_PAGE_SIZE = 10;

// ── View Switcher ─────────────────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar__item').forEach(i => i.classList.remove('active'));

  const panel = document.getElementById(`panel-${view}`);
  if (panel) panel.classList.add('active');

  const sidebarItem = document.querySelector(`[data-view="${view}"]`);
  if (sidebarItem) sidebarItem.classList.add('active');

  const titleEl = document.getElementById('topbar-title');
  const titles = {
    dashboard:    '📊 Dashboard',
    posts:        '📝 All Posts',
    'new-post':   '✏️ New Post',
    connections:  '🔌 Connections',
    settings:     '⚙️ Settings & Backup',
  };
  if (titleEl) titleEl.textContent = titles[view] || 'Dashboard';

  currentView = view;

  if (view === 'dashboard')    renderDashboard();
  if (view === 'posts')        renderPostsTable();
  if (view === 'new-post')     openEditor(null);
  if (view === 'connections')  renderConnections();
  if (view === 'settings')     renderSettings();

  if (view === 'connections') startConnectionsPolling();
  else stopConnectionsPolling();
}

// ── Sidebar nav ───────────────────────────────────────────────
function initSidebar() {
  document.querySelectorAll('.sidebar__item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      editingPostId = null;
      switchView(view);
    });
  });

  // Sidebar toggle (mobile + collapse)
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar   = document.querySelector('.admin-sidebar');
  const main      = document.querySelector('.admin-main');

  if (toggleBtn && sidebar && main) {
    toggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
      } else {
        sidebar.classList.toggle('collapsed');
        main.classList.toggle('expanded');
      }
    });
  }

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    Modal.show('Logout', 'Are you sure you want to logout?', [
      { label: 'Cancel', class: 'btn--secondary', onClick: () => {} },
      { label: 'Logout', class: 'btn--danger',    onClick: () => logout() },
    ]);
  });

  document.getElementById('topbar-logout')?.addEventListener('click', () => {
    logout();
  });
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const allPosts   = PostsDB.getAll();
  const published  = allPosts.filter(p => p.status === 'published');
  const drafts     = allPosts.filter(p => p.status !== 'published');
  const ctfs       = allPosts.filter(p => p.type === 'ctf');
  const totalViews = PostsDB.getTotalViews();

  setVal('dash-total',     allPosts.length);
  setVal('dash-published', published.length);
  setVal('dash-drafts',    drafts.length);
  setVal('dash-ctfs',      ctfs.length);
  setVal('dash-views',     totalViews);

  // Recent posts table
  const tbody = document.getElementById('recent-tbody');
  if (tbody) {
    const recent = allPosts.slice(0, 5);
    tbody.innerHTML = recent.map(p => `
      <tr>
        <td><span class="data-table__title">${escapeHtml(p.title)}</span></td>
        <td><span class="badge badge--${tagColor(p.category || 'default')}">${p.type || 'post'}</span></td>
        <td><span class="status-pill status-pill--${p.status || 'draft'}">${p.status || 'draft'}</span></td>
        <td>${formatDate(p.date)}</td>
        <td>
          <div class="data-table__actions">
            <button class="action-btn action-btn--edit" onclick="openEditorById('${p.id}')">✏️ Edit</button>
            <button class="action-btn action-btn--delete" onclick="deletePost('${p.id}')">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Posts Table ───────────────────────────────────────────────
function renderPostsTable() {
  let posts = PostsDB.getAll();

  // Search
  if (tableSearch) {
    const q = tableSearch.toLowerCase();
    posts = posts.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }

  // Sort
  posts.sort((a, b) => {
    let av = a[tableSortCol] || '', bv = b[tableSortCol] || '';
    if (tableSortCol === 'date') { av = new Date(av); bv = new Date(bv); }
    if (av < bv) return tableSortDir === 'asc' ? -1 : 1;
    if (av > bv) return tableSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const total = posts.length;
  const totalPages = Math.ceil(total / TABLE_PAGE_SIZE);
  tablePage = Math.min(tablePage, Math.max(1, totalPages));
  const start = (tablePage - 1) * TABLE_PAGE_SIZE;
  const pagePosts = posts.slice(start, start + TABLE_PAGE_SIZE);

  // Render rows
  const tbody = document.getElementById('posts-tbody');
  if (!tbody) return;

  if (pagePosts.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">
        No posts found.
      </td></tr>
    `;
  } else {
    tbody.innerHTML = pagePosts.map(p => `
      <tr>
        <td><span class="data-table__title">${escapeHtml(p.title)}</span></td>
        <td><span class="badge badge--${tagColor(p.type || 'default')}">${p.type || 'post'}</span></td>
        <td><span class="status-pill status-pill--${p.status || 'draft'}">${p.status || 'draft'}</span></td>
        <td style="font-family:var(--font-mono);font-size:0.8rem">${formatDate(p.date)}</td>
        <td style="font-family:var(--font-mono);font-size:0.8rem">${PostsDB.getViews(p.id)}</td>
        <td>
          <div class="data-table__actions">
            <button class="action-btn action-btn--view" onclick="window.open('post.html?id=${p.id}','_blank')">👁 View</button>
            <button class="action-btn action-btn--edit" onclick="openEditorById('${p.id}')">✏️ Edit</button>
            <button class="action-btn action-btn--delete" onclick="deletePost('${p.id}')">🗑 Del</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Pagination controls
  const pagination = document.getElementById('posts-pagination');
  if (pagination) {
    let html = `
      <button class="page-btn" onclick="gotoPage(${tablePage - 1})" ${tablePage === 1 ? 'disabled' : ''}>‹</button>
    `;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn ${i === tablePage ? 'active' : ''}" onclick="gotoPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="gotoPage(${tablePage + 1})" ${tablePage === totalPages ? 'disabled' : ''}>›</button>`;
    html += `<span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-muted);margin-left:12px">${total} posts</span>`;
    pagination.innerHTML = html;
  }

  // Sort headers
  document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.className = '';
    const col = th.getAttribute('data-sort');
    if (col === tableSortCol) th.className = `sort-${tableSortDir}`;
    th.onclick = () => {
      if (tableSortCol === col) {
        tableSortDir = tableSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        tableSortCol = col;
        tableSortDir = 'asc';
      }
      tablePage = 1;
      renderPostsTable();
    };
  });
}

function gotoPage(page) {
  tablePage = page;
  renderPostsTable();
}

// ── Editor ────────────────────────────────────────────────────
function openEditor(post) {
  const panel = document.getElementById('panel-new-post');
  if (!panel) return;

  panel.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => {
    if (p !== panel) p.classList.remove('active');
  });

  const titleEl     = document.getElementById('editor-title');
  const excerptEl   = document.getElementById('editor-excerpt');
  const categoryEl  = document.getElementById('editor-category');
  const typeEl      = document.getElementById('editor-type');
  const diffEl      = document.getElementById('editor-difficulty');
  const platformEl  = document.getElementById('editor-platform');
  const pointsEl    = document.getElementById('editor-points');
  const dateEl       = document.getElementById('editor-date');
  const emojiEl      = document.getElementById('editor-emoji');
  const coverImageEl = document.getElementById('editor-cover-image');
  const statusEl     = document.getElementById('editor-status');
  const topbarTitle  = document.getElementById('topbar-title');

  if (post) {
    editingPostId = post.id;
    if (topbarTitle)  topbarTitle.textContent  = '✏️ Edit Post';
    if (titleEl)     titleEl.value     = post.title || '';
    if (excerptEl)   excerptEl.value   = post.excerpt || '';
    if (categoryEl)  categoryEl.value  = post.category || 'general';
    if (typeEl)      typeEl.value      = post.type || 'post';
    if (diffEl)      diffEl.value      = post.difficulty || 'medium';
    if (platformEl)  platformEl.value  = post.platform || '';
    if (pointsEl)    pointsEl.value    = post.points || 0;
    if (dateEl)      dateEl.value      = post.date || new Date().toISOString().split('T')[0];
    if (emojiEl)     emojiEl.value     = post.emoji || '📄';
    if (coverImageEl) coverImageEl.value = post.coverImage || '';
    if (statusEl)    statusEl.checked  = post.status === 'published';
    setTags(post.tags || []);
    // Set markdown content
    if (mde) mde.value(post.content || '');
  } else {
    editingPostId = null;
    if (topbarTitle)  topbarTitle.textContent  = '✏️ New Post';
    if (titleEl)     titleEl.value     = '';
    if (excerptEl)   excerptEl.value   = '';
    if (categoryEl)  categoryEl.value  = 'general';
    if (typeEl)      typeEl.value      = 'post';
    if (diffEl)      diffEl.value      = 'medium';
    if (platformEl)  platformEl.value  = '';
    if (pointsEl)    pointsEl.value    = 0;
    if (dateEl)      dateEl.value      = new Date().toISOString().split('T')[0];
    if (emojiEl)     emojiEl.value     = '📄';
    if (coverImageEl) coverImageEl.value = '';
    if (statusEl)    statusEl.checked  = false;
    setTags([]);
    if (mde) mde.value('');
  }

  // Show/hide CTF fields based on type
  updateTypeFields();
}

function openEditorById(id) {
  const post = PostsDB.getById(id);
  if (!post) { Toast.error('Post not found.'); return; }
  switchView('new-post');
  openEditor(post);
}

function updateTypeFields() {
  const typeEl   = document.getElementById('editor-type');
  const ctfFields = document.getElementById('ctf-fields');
  if (!typeEl || !ctfFields) return;
  ctfFields.style.display = typeEl.value === 'ctf' ? 'block' : 'none';
}

// ── Tags input ────────────────────────────────────────────────
let currentTags = [];

function setTags(tags) {
  currentTags = [...tags];
  renderTagPills();
}

function renderTagPills() {
  const wrapper = document.getElementById('tags-wrapper');
  if (!wrapper) return;

  // Remove existing pills
  wrapper.querySelectorAll('.tag-pill').forEach(p => p.remove());

  const input = document.getElementById('tags-input');

  currentTags.forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.innerHTML = `${escapeHtml(tag)} <span class="tag-pill__remove" data-tag="${escapeHtml(tag)}">✕</span>`;
    pill.querySelector('.tag-pill__remove').addEventListener('click', () => removeTag(tag));
    if (input) wrapper.insertBefore(pill, input);
    else wrapper.appendChild(pill);
  });
}

function addTag(tag) {
  tag = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (tag && !currentTags.includes(tag) && currentTags.length < 10) {
    currentTags.push(tag);
    renderTagPills();
  }
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTagPills();
}

function initTagsInput() {
  const input = document.getElementById('tags-input');
  if (!input) return;

  input.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      addTag(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && currentTags.length) {
      removeTag(currentTags[currentTags.length - 1]);
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addTag(input.value);
      input.value = '';
    }
  });
}

// ── Save post ─────────────────────────────────────────────────
function savePost(publish = null) {
  savePostAsync(publish);
}

async function savePostAsync(publish = null) {
  const titleEl   = document.getElementById('editor-title');
  const excerptEl = document.getElementById('editor-excerpt');
  if (!titleEl) return;

  const title = titleEl.value.trim();
  if (!title) { Toast.error('Title is required.'); titleEl.focus(); return; }

  const content = mde ? mde.value() : '';

  // Estimate read time
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const readTime  = Math.max(1, Math.ceil(wordCount / 200));

  const statusEl = document.getElementById('editor-status');
  let status = statusEl && statusEl.checked ? 'published' : 'draft';
  if (publish === true)  status = 'published';
  if (publish === false) status = 'draft';

  const post = {
    id:         editingPostId || null,
    title,
    excerpt:    document.getElementById('editor-excerpt')?.value.trim() || '',
    content,
    category:   document.getElementById('editor-category')?.value || 'general',
    type:       document.getElementById('editor-type')?.value || 'post',
    difficulty: document.getElementById('editor-difficulty')?.value || 'medium',
    platform:   document.getElementById('editor-platform')?.value || '',
    points:     parseInt(document.getElementById('editor-points')?.value || '0', 10),
    date:       document.getElementById('editor-date')?.value || new Date().toISOString().split('T')[0],
    emoji:      document.getElementById('editor-emoji')?.value || '📄',
    coverImage: document.getElementById('editor-cover-image')?.value.trim() || '',
    featured:   false,
    status,
    readTime,
    tags:       [...currentTags],
  };

  try {
    const saved = await PostsDB.save(post);
    editingPostId = saved.id || saved._id;
    if (PostsDB.isApiMode()) {
      Toast.success(`Post ${status === 'published' ? 'published' : 'saved as draft'} to MongoDB!`);
    } else {
      Toast.warning(`Saved to local storage (Backend API Offline / MongoDB Disconnected).`);
    }
    updatePostBadge();
    if (currentView === 'dashboard') renderDashboard();
  } catch (err) {
    Toast.error('Save failed: ' + (err.message || 'Unknown error'));
  }
}

// ── Sync Local Posts to MongoDB ────────────────────────────────
async function syncLocalPostsToMongoDB() {
  if (typeof BlogAPI === 'undefined') return;
  try {
    const online = await BlogAPI.checkHealth();
    if (!online) {
      Toast.error('Backend API is offline. Start your backend server first.');
      return;
    }
    const localPosts = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    if (!localPosts.length) {
      Toast.info('No local posts found in browser storage.');
      return;
    }
    let count = 0;
    for (const post of localPosts) {
      await BlogAPI.savePost(post);
      count++;
    }
    PostsDB._mode = 'api';
    await PostsDB.reload(true);
    Toast.success(`Successfully synced ${count} post(s) to MongoDB Atlas!`);
    if (typeof renderPostsTable === 'function') renderPostsTable();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch (err) {
    Toast.error('Sync failed: ' + (err.message || 'Unknown error'));
  }
}

// ── Delete post ───────────────────────────────────────────────
function deletePost(id) {
  const post = PostsDB.getById(id);
  if (!post) return;

  Modal.show(
    '🗑 Delete Post',
    `Are you sure you want to delete "${post.title}"? This cannot be undone.`,
    [
      { label: 'Cancel',  class: 'btn--secondary', onClick: () => {} },
      { label: 'Delete',  class: 'btn--danger',    onClick: async () => {
        try {
          await PostsDB.delete(id);
          Toast.success('Post deleted.');
          renderPostsTable();
          renderDashboard();
          updatePostBadge();
          if (editingPostId === id) {
            editingPostId = null;
            switchView('posts');
          }
        } catch (err) {
          Toast.error('Delete failed: ' + err.message);
        }
      }},
    ]
  );
}

function updatePostBadge() {
  const badge = document.getElementById('posts-badge');
  if (badge) badge.textContent = PostsDB.getAll().length;
}

// ── Init EasyMDE ──────────────────────────────────────────────
function initEditor() {
  const textarea = document.getElementById('editor-content');
  if (!textarea || typeof EasyMDE === 'undefined') return;

  mde = new EasyMDE({
    element: textarea,
    autofocus: false,
    spellChecker: false,
    nativeSpellcheck: false,
    lineNumbers: true,
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'code', 'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', 'table', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'undo', 'redo',
    ],
    placeholder: 'Write your post in Markdown…\n\n## Section Heading\n\nYour content here…\n\n```bash\n# Code blocks are supported\nnmap -sC -sV target.com\n```',
    status: ['autosave', 'lines', 'words', 'cursor'],
    autosave: {
      enabled: true,
      delay: 5000,
      uniqueId: 'admin-editor',
    },
    renderingConfig: {
      singleLineBreaks: false,
      codeSyntaxHighlighting: true,
    },
  });

  // Attach local image file uploader helper
  const btnInsert = document.getElementById('btn-insert-image');
  const fileInput = document.getElementById('editor-image-file');
  if (btnInsert && fileInput) {
    btnInsert.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64Url = evt.target.result;
        const alt = file.name.replace(/\.[^/.]+$/, '');
        const markdownImage = `\n![${alt}](${base64Url})\n`;
        if (mde) {
          const pos = mde.codemirror.getCursor();
          mde.codemirror.replaceRange(markdownImage, pos);
        }
        if (typeof Toast !== 'undefined') Toast.success(`Image "${file.name}" inserted!`);
        fileInput.value = '';
      };
      reader.readAsDataURL(file);
    });
  }
}

// ── Settings / Backup ─────────────────────────────────────────
function renderSettings() {
  const stats = document.getElementById('backup-stats');
  if (stats) {
    const posts = PostsDB.getAll();
    const size  = new Blob([PostsDB.exportJSON()]).size;
    stats.textContent = `${posts.length} posts · ${(size / 1024).toFixed(1)} KB`;
  }
}

function exportPosts() {
  const json = PostsDB.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sw-blog-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  Toast.success('Backup downloaded!');
}

function initImportDrop() {
  const zone   = document.getElementById('import-zone');
  const fileIn = document.getElementById('import-file');
  if (!zone) return;

  zone.addEventListener('click', () => fileIn?.click());

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });

  fileIn?.addEventListener('change', () => {
    if (fileIn.files[0]) handleImportFile(fileIn.files[0]);
  });
}

function handleImportFile(file) {
  if (!file.name.endsWith('.json')) {
    Toast.error('Please select a JSON backup file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    Modal.show(
      '⬆️ Import Backup',
      `Import "${file.name}"? This will REPLACE all existing posts. Make sure you have a backup.`,
      [
        { label: 'Cancel', class: 'btn--secondary', onClick: () => {} },
        { label: 'Import', class: 'btn--primary',   onClick: async () => {
          try {
            const count = await PostsDB.importJSON(e.target.result);
            Toast.success(`Imported ${count} posts successfully!`);
            renderDashboard();
            updatePostBadge();
          } catch (err) {
            Toast.error('Import failed: ' + err.message);
          }
        }},
      ]
    );
  };
  reader.readAsText(file);
}

// ── Change password (UI) ──────────────────────────────────────
function initChangePassword() {
  // Form submission is handled in admin/dashboard.html to support both API & local auth cleanly.
}

// ── Table search ──────────────────────────────────────────────
function initTableSearch() {
  const input = document.getElementById('table-search');
  if (!input) return;
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      tableSearch = input.value.trim();
      tablePage = 1;
      renderPostsTable();
    }, 250);
  });
}

// ── HTML Escape ───────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

// ── Quick New Post button ─────────────────────────────────────
function initQuickNew() {
  document.getElementById('btn-new-post')?.addEventListener('click', () => {
    editingPostId = null;
    switchView('new-post');
  });

  document.getElementById('btn-new-post-2')?.addEventListener('click', () => {
    editingPostId = null;
    switchView('new-post');
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await PostsDB.ready(true);
  await requireAuth();

  initSidebar();
  initEditor();
  initTagsInput();
  initTableSearch();
  initImportDrop();
  initChangePassword();
  initQuickNew();
  initConnectionsPanel();

  // Type select change
  document.getElementById('editor-type')?.addEventListener('change', updateTypeFields);

  // Save / Publish buttons
  document.getElementById('btn-save-draft')?.addEventListener('click', () => savePost(false));
  document.getElementById('btn-publish')?.addEventListener('click', () => savePost(true));

  // Export
  document.getElementById('btn-export')?.addEventListener('click', exportPosts);

  // Start on dashboard
  switchView('dashboard');
  updatePostBadge();
});
