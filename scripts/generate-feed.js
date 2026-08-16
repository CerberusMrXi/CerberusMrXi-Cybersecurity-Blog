#!/usr/bin/env node
/** Regenerate feed.xml + sitemap.xml from assets/data/posts.json */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const posts = JSON.parse(
  fs.readFileSync(path.join(root, 'assets', 'data', 'posts.json'), 'utf8')
);
const site = process.env.SITE_URL || 'https://cerberusmrxi.github.io';

const published = posts
  .filter((p) => p.status === 'published')
  .sort((a, b) => +new Date(b.date) - +new Date(a.date));

const items = published
  .map(
    (p) => `    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${site}/post.html?id=${p.id}</link>
      <guid isPermaLink="false">${p.id}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description><![CDATA[${p.excerpt || ''}]]></description>
      <category>${p.type === 'ctf' ? 'CTF' : 'Blog'}</category>
    </item>`
  )
  .join('\n');

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>CerberusMrXi</title>
    <link>${site}/</link>
    <description>Offensive security research, exploit notes, and CTF writeups by Sudeepa Wanigarathna.</description>
    <language>en-us</language>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

const urls = [
  '',
  'index.html',
  'ctf.html',
  'about.html',
  ...published.map((p) => `post.html?id=${p.id}`),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${site}/${u}</loc></url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(root, 'feed.xml'), feed);
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);
console.log(`Updated feed.xml + sitemap.xml (${published.length} posts) → ${site}`);
