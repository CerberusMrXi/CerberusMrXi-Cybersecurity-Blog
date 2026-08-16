/* ============================================================
   Single Post Renderer | post.js
   ============================================================ */

function waitForLibs() {
  return new Promise((resolve) => {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      resolve();
      return;
    }
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (
        (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') ||
        n > 80
      ) {
        clearInterval(t);
        resolve();
      }
    }, 50);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await PostsDB.ready();
  await waitForLibs();

  const postId = getParam('id');
  if (!postId) {
    showError('No post specified.');
    return;
  }

  const post = PostsDB.getById(postId);
  if (!post || post.status !== 'published') {
    showError('Post not found or not published.');
    return;
  }

  await PostsDB.incrementViews(postId);
  renderPost(post);
});

function setMeta(name, content, prop = false) {
  const attr = prop ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function renderPost(post) {
  const siteTitle = `${post.title} — Sudeepa Wanigarathna`;
  document.title = siteTitle;

  setMeta('description', post.excerpt || post.title);
  setMeta('og:title', post.title, true);
  setMeta('og:description', post.excerpt || post.title, true);
  setMeta('og:type', 'article', true);
  setMeta('twitter:card', 'summary');
  setMeta('twitter:title', post.title);
  setMeta('twitter:description', post.excerpt || post.title);

  const back = document.getElementById('back-link');
  if (back) {
    if (post.type === 'ctf') {
      back.href = 'ctf.html';
      back.textContent = '← CTF Writeups';
    } else {
      back.href = 'index.html';
      back.textContent = '← Blog';
    }
  }

  const title = document.getElementById('post-title');
  const desc = document.getElementById('post-desc');
  const date = document.getElementById('post-date');
  const readtime = document.getElementById('post-readtime');
  const tags = document.getElementById('post-tags');
  const views = document.getElementById('post-views');

  if (title) title.textContent = post.title;
  if (desc) desc.textContent = post.excerpt || '';
  if (date) date.textContent = formatDate(post.date);
  if (readtime) readtime.textContent = `${post.readTime || 5} min read`;
  if (views) views.textContent = `${PostsDB.getViews(post.id)} views`;
  if (tags) {
    tags.innerHTML = (post.tags || [])
      .map((t) => `<span class="badge badge--${tagColor(t)}">${t}</span>`)
      .join('');
  }

  renderCoverImage(post);
  renderCtfMeta(post);
  renderMarkdown(post);
  renderFooter(post);
  renderNavRelated(post);
}

function renderCoverImage(post) {
  const coverEl = document.getElementById('post-cover-banner');
  if (!coverEl) return;
  if (post.coverImage) {
    coverEl.hidden = false;
    coverEl.innerHTML = `<img src="${escapeText(post.coverImage)}" alt="${escapeText(post.title)}" style="width:100%;max-height:420px;object-fit:cover;border-radius:var(--radius-lg);margin-bottom:24px;border:1px solid var(--border-subtle);box-shadow:var(--shadow-card)" />`;
  } else {
    coverEl.hidden = true;
    coverEl.innerHTML = '';
  }
}

function renderCtfMeta(post) {
  const box = document.getElementById('ctf-meta');
  if (!box) return;
  if (post.type !== 'ctf') {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <dl class="ctf-meta__grid">
      <div><dt>Platform</dt><dd>${escapeText(post.platform || '—')}</dd></div>
      <div><dt>Difficulty</dt><dd><span class="badge diff--${(post.difficulty || 'medium').toLowerCase()}">${escapeText(post.difficulty || 'Medium')}</span></dd></div>
      <div><dt>Points</dt><dd>${post.points != null ? post.points : '—'}</dd></div>
      <div><dt>Category</dt><dd>${escapeText(post.category || 'ctf')}</dd></div>
    </dl>
  `;
}

function escapeText(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function renderMarkdown(post) {
  const contentEl = document.getElementById('post-content');
  if (!contentEl) return;

  if (typeof marked === 'undefined') {
    contentEl.innerHTML = `<pre>${escapeText(post.content || '')}</pre>`;
    return;
  }

  marked.setOptions({ gfm: true, breaks: true });
  let html = marked.parse(post.content || '');

  if (typeof DOMPurify !== 'undefined') {
    html = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'a', 'strong', 'em',
        'blockquote', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img', 'hr', 'br', 'span', 'div',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'target', 'rel'],
    });
  }

  contentEl.innerHTML = html;

  contentEl.querySelectorAll('pre').forEach((pre) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = 'Copy'), 2000);
      });
    });
    wrapper.appendChild(btn);
  });

  if (typeof hljs !== 'undefined') {
    contentEl.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  buildTOC(contentEl);
}

function renderFooter(post) {
  const footerTags = document.getElementById('post-footer-tags');
  if (footerTags) {
    footerTags.innerHTML = (post.tags || [])
      .map((t) => `<span class="badge badge--${tagColor(t)}">${t}</span>`)
      .join('');
  }

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(post.title);

  const shareTwitter = document.getElementById('share-twitter');
  if (shareTwitter) {
    shareTwitter.href = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}&via=SudeepaWanigar1`;
  }

  const shareLinkedIn = document.getElementById('share-linkedin');
  if (shareLinkedIn) {
    shareLinkedIn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
  }

  const shareCopy = document.getElementById('share-copy');
  if (shareCopy) {
    shareCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        if (typeof Toast !== 'undefined') Toast.success('Link copied');
        else shareCopy.textContent = 'Copied';
      });
    });
  }
}

function renderNavRelated(post) {
  const { prev, next } = PostsDB.getNeighbors(post);
  const prevEl = document.getElementById('post-prev');
  const nextEl = document.getElementById('post-next');

  if (prevEl) {
    if (prev) {
      prevEl.href = `post.html?id=${encodeURIComponent(prev.id)}`;
      prevEl.innerHTML = `<span class="post-nav__label">Previous</span><span class="post-nav__title">${escapeText(prev.title)}</span>`;
      prevEl.hidden = false;
    } else prevEl.hidden = true;
  }

  if (nextEl) {
    if (next) {
      nextEl.href = `post.html?id=${encodeURIComponent(next.id)}`;
      nextEl.innerHTML = `<span class="post-nav__label">Next</span><span class="post-nav__title">${escapeText(next.title)}</span>`;
      nextEl.hidden = false;
    } else nextEl.hidden = true;
  }

  const relatedEl = document.getElementById('related-posts');
  if (!relatedEl) return;
  const related = PostsDB.getRelated(post, 3);
  if (!related.length) {
    relatedEl.hidden = true;
    return;
  }
  relatedEl.hidden = false;
  relatedEl.innerHTML = `
    <h2 class="related__heading">Related</h2>
    <div class="related__grid">
      ${related
        .map(
          (p) => `
        <a class="related__card" href="post.html?id=${encodeURIComponent(p.id)}">
          <span class="related__type">${p.type === 'ctf' ? 'CTF' : 'Post'}</span>
          <span class="related__title">${escapeText(p.title)}</span>
          <span class="related__meta">${formatDate(p.date)} · ${p.readTime || 5} min</span>
        </a>`
        )
        .join('')}
    </div>
  `;
}

function buildTOC(contentEl) {
  const tocList = document.getElementById('toc-list');
  if (!tocList) return;
  tocList.innerHTML = '';

  const headings = contentEl.querySelectorAll('h2, h3');
  const tocEl = document.querySelector('.post-toc');
  if (headings.length < 2) {
    if (tocEl) tocEl.style.display = 'none';
    return;
  }
  if (tocEl) tocEl.style.display = '';

  headings.forEach((h, i) => {
    const id = `heading-${i}`;
    h.id = id;

    const li = document.createElement('li');
    li.className = `post-toc__item${h.tagName === 'H3' ? ' post-toc__item--h3' : ''}`;

    const a = document.createElement('a');
    a.className = 'post-toc__link';
    a.href = `#${id}`;
    a.textContent = h.textContent;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    li.appendChild(a);
    tocList.appendChild(li);
  });

  const links = tocList.querySelectorAll('.post-toc__link');
  const headingEls = Array.from(headings);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('active'));
          const idx = headingEls.indexOf(entry.target);
          if (idx >= 0 && links[idx]) links[idx].classList.add('active');
        }
      });
    },
    { rootMargin: '-20% 0% -75% 0%' }
  );

  headingEls.forEach((h) => observer.observe(h));

  const tocToggle = document.getElementById('toc-toggle');
  if (tocToggle && tocEl) {
    tocToggle.addEventListener('click', () => {
      tocEl.classList.toggle('post-toc--open');
    });
  }
}

function showError(msg) {
  const main = document.getElementById('main-content');
  if (main) {
    main.innerHTML = `
      <div class="container">
        <div class="empty-state" style="padding:120px 20px">
          <div class="empty-state__icon">!</div>
          <h3>${escapeText(msg)}</h3>
          <p style="margin-top:16px"><a href="index.html" class="btn btn--secondary">← Back to Blog</a></p>
        </div>
      </div>
    `;
  }
}
