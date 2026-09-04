/* eslint-disable no-console */
/**
 * Renders every documentation page in docs/ into self-contained HTML with a shared
 * navigation bar, plus an index that links them. Run: node tools/make-docs-html.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const PAGES = [
  { md: 'docs/INSTALL-HOSTING.md', out: 'docs/install-hosting.html', nav: 'Hosting install' },
  { md: 'docs/INSTALL-GITHUB.md', out: 'docs/install-source.html', nav: 'Source install' },
  { md: 'docs/INSTALL-CODECANYON.md', out: 'docs/install-package.html', nav: 'Package guide' },
  { md: 'docs/DOCUMENTATION.md', out: 'docs/documentation.html', nav: 'Full documentation' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) => {
      const page = PAGES.find((p) => p.md.endsWith(href.replace(/^\.\//, '')));
      return `<a href="${page ? page.out.replace('docs/', '') : href}">${t}</a>`;
    });

function render(md) {
  const lines = md.split('\n');
  const html = [];
  let i = 0;
  let listOpen = null; // 'ul' | 'ol' | null
  const closeList = () => {
    if (listOpen) {
      html.push(`</${listOpen}>`);
      listOpen = null;
    }
  };
  const openList = (kind) => {
    if (listOpen !== kind) {
      closeList();
      html.push(`<${kind}>`);
      listOpen = kind;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      closeList();
      html.push(`<pre class="lang-${lang || 'text'}"><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\|/.test(line) && /^\|[\s:|-]+\|$/.test(lines[i + 1] ?? '')) {
      const head = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      closeList();
      html.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      html.push('<hr/>');
      i++;
      continue;
    }

    const bullet = line.match(/^\s*[*-]\s+(.*)$/);
    if (bullet) {
      openList('ul');
      html.push(`<li>${inline(bullet[1])}</li>`);
      i++;
      continue;
    }

    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      openList('ol');
      const buf = [numbered[1]];
      i++;
      // keep wrapped continuation lines inside the same item
      while (i < lines.length && lines[i].trim() && !/^\s*(\d+\.|[*-])\s|^[#>|`]|^```/.test(lines[i])) {
        buf.push(lines[i].trim());
        i++;
      }
      html.push(`<li>${inline(buf.join(' '))}</li>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      i++;
      continue;
    }

    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^\s*\d+\.\s/.test(lines[i]) && !/^[#>*\-|`]/.test(lines[i]))
      buf.push(lines[i++]);
    closeList();
    html.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  closeList();
  return html.join('\n');
}

const STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; padding:0 20px 80px; background:#140418; color:#efe6f5;
         font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  header.bar { position:sticky; top:0; z-index:5; margin:0 -20px 34px; padding:14px 20px;
               background:rgba(20,4,24,.94); backdrop-filter:blur(8px);
               border-bottom:1px solid #3a1f47; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  header.bar b { color:#ffd257; margin-right:14px; letter-spacing:.04em; }
  header.bar a { color:#cbb6d8; text-decoration:none; padding:5px 11px; border-radius:8px;
                 border:1px solid transparent; font-size:14px; }
  header.bar a:hover { border-color:#4a2a58; color:#fff; }
  header.bar a.on { background:#31173b; color:#ffd257; border-color:#5a2f6b; }
  main { max-width: 880px; margin: 0 auto; }
  h1 { font-size:34px; margin:0 0 6px; color:#ffd257; letter-spacing:.02em; }
  h2 { font-size:23px; margin:44px 0 12px; color:#ffb9ec; border-bottom:1px solid #3a1f47; padding-bottom:8px; }
  h3 { font-size:18px; margin:26px 0 8px; color:#ffe9a8; }
  h4 { font-size:16px; margin:20px 0 6px; color:#cbb6d8; }
  p { margin:10px 0; }
  a { color:#7cd3ff; }
  hr { border:0; border-top:1px solid #33193d; margin:34px 0; }
  code { background:#25102e; padding:2px 6px; border-radius:5px; font-size:14px;
         font-family:"SFMono-Regular",Menlo,Consolas,monospace; color:#ffd9a8; }
  pre { background:#1c0a24; border:1px solid #3a1f47; border-radius:10px; padding:14px 16px;
        overflow:auto; margin:14px 0; }
  pre code { background:none; padding:0; color:#d8e6ff; }
  table { border-collapse:collapse; width:100%; margin:14px 0; font-size:15px; }
  th, td { border:1px solid #3a1f47; padding:8px 11px; text-align:left; vertical-align:top; }
  th { background:#24102c; color:#ffd257; }
  ul, ol { margin:10px 0; padding-left:24px; }
  ol li::marker { color:#ffd257; font-weight:700; }
  li { margin:5px 0; }
  strong { color:#fff; }
  .cards { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); margin:24px 0; }
  .card { display:block; padding:18px; border-radius:12px; background:#1e0a26; border:1px solid #3a1f47;
          text-decoration:none; color:inherit; }
  .card:hover { border-color:#ffd257; }
  .card b { display:block; color:#ffd257; font-size:17px; margin-bottom:6px; }
  .card span { color:#cbb6d8; font-size:14px; }
`;

const nav = (current) =>
  `<header class="bar"><b>LUCKY BANDITS</b><a href="index.html"${current === 'index' ? ' class="on"' : ''}>Start here</a>` +
  PAGES.map(
    (p) => `<a href="${p.out.replace('docs/', '')}"${current === p.out ? ' class="on"' : ''}>${p.nav}</a>`,
  ).join('') +
  '</header>';

const page = (title, current, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${STYLE}</style></head>
<body>${nav(current)}<main>${body}</main></body></html>
`;

for (const p of PAGES) {
  const body = render(await readFile(p.md, 'utf8'));
  await writeFile(p.out, page(`Lucky Bandits — ${p.nav}`, p.out, body));
  console.log(`  ✓ ${p.out}`);
}

const index = `
<h1>Lucky Bandits — documentation</h1>
<p>HTML5 video slot, version 1.0.0. Three packages are supplied; start with the one you
downloaded.</p>
<div class="cards">
  <a class="card" href="install-hosting.html"><b>Hosting package →</b>
    <span>LuckyBandits-Hosting.zip · upload the files and play. No Node.js, no build.</span></a>
  <a class="card" href="install-source.html"><b>Source package →</b>
    <span>LuckyBandits-GitHub.zip · npm install, develop, build, deploy.</span></a>
  <a class="card" href="install-package.html"><b>CodeCanyon package →</b>
    <span>Build + Source + docs in one archive. Overview and both routes.</span></a>
  <a class="card" href="documentation.html"><b>Full documentation →</b>
    <span>Configuration, maths, artwork replacement, API integration, troubleshooting.</span></a>
</div>
<h2>In one minute</h2>
<pre><code># just publish it
unzip LuckyBandits-Hosting.zip -d lucky-bandits
# upload the contents of lucky-bandits/ to your web space — done

# or build it yourself
unzip LuckyBandits-GitHub.zip &amp;&amp; cd LuckyBandits
npm install
npm run dev      # http://localhost:5180
npm run build    # upload the contents of dist/</code></pre>
<h2>Requirements</h2>
<table><thead><tr><th>Package</th><th>Needs</th><th>Size</th></tr></thead><tbody>
<tr><td>Hosting</td><td>any static web server</td><td>2.0 MB</td></tr>
<tr><td>Source (GitHub)</td><td>Node.js 20+, npm</td><td>19.4 MB</td></tr>
<tr><td>CodeCanyon</td><td>either of the above</td><td>23.0 MB</td></tr>
</tbody></table>
<p>Players need a browser with WebGL and WebP: Chrome/Edge 90+, Safari 14+, Firefox 90+,
desktop or mobile.</p>
`;
await writeFile('docs/index.html', page('Lucky Bandits — documentation', 'index', index));
console.log('  ✓ docs/index.html');
