import { readdirSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Root } from './interface/response';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonDir = path.join(__dirname, 'output_json');
const htmlDir = path.join(__dirname, 'output_html');

mkdirSync(htmlDir, { recursive: true });

// Ambil semua file JSON response
const files = readdirSync(jsonDir).filter(f => f.startsWith('response_') && f.endsWith('.json'));

interface TokenRow {
  key: string;
  input: number | null;
  output: number | null;
  total: number | null;
  reasoning?: number | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtmlPage(fileName: string, root: Root): string {
  const dataHtml = root.data || '';
  const token = (root.metadata && root.metadata.token) || {} as any;
  const rows: TokenRow[] = [];
  for (const key of Object.keys(token)) {
    const obj = (token as any)[key];
    if (obj && typeof obj === 'object') {
      rows.push({
        key,
        input: typeof obj.inputTokenCount === 'number' ? obj.inputTokenCount : null,
        output: typeof obj.outputTokenCount === 'number' ? obj.outputTokenCount : null,
        total: typeof obj.totalTokenCount === 'number' ? obj.totalTokenCount : null,
        reasoning: obj.outputTokenDetails && typeof obj.outputTokenDetails.reasoningTokenCount === 'number'
          ? obj.outputTokenDetails.reasoningTokenCount
          : null,
      });
    }
  }

  const style = `body{font-family:Segoe UI,Arial,sans-serif;margin:24px;line-height:1.4;background:#fafafa;color:#222}h1{margin-top:0}table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f0f0f0}tr:nth-child(even){background:#f9f9f9}code{background:#eee;padding:2px 4px;border-radius:4px}footer{margin-top:40px;font-size:12px;color:#666}nav a{margin-right:12px;text-decoration:none;color:#0366d6}nav a:hover{text-decoration:underline}.badge{display:inline-block;background:#0366d6;color:#fff;padding:2px 6px;border-radius:4px;font-size:12px}`;

  const tokenTable = rows.length
    ? `<table><thead><tr><th>Kunci</th><th>Input Token</th><th>Output Token</th><th>Total Token</th><th>Reasoning Token</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.key}</td><td>${r.input ?? ''}</td><td>${r.output ?? ''}</td><td>${r.total ?? ''}</td><td>${r.reasoning ?? ''}</td></tr>`).join('')}
    </tbody></table>`
    : '<p><em>Tidak ada data token.</em></p>';

  // Metadata + input lengkap
  const meta = root.metadata?.input;
  let metaBlock = '';
  let fullInputBlock = '';
  if (meta) {
    metaBlock = `<section><h2>Ringkasan Input</h2><ul>
      <li><strong>Mode Emosi:</strong> ${escapeHtml(meta.modeEmosi)}</li>
      <li><strong>Gaya Bahasa:</strong> ${escapeHtml(meta.modeGayaBahasa)}</li>
      <li><strong>Panjang Forum Dosen (karakter):</strong> ${meta.forumDosen.length}</li>
      <li><strong>Jumlah Post Mahasiswa:</strong> ${meta.forumMahasiswa.length}</li>
      <li><strong>Sumber Buku:</strong> ${escapeHtml(meta.bookSource)}</li>
    </ul></section>`;

    const forumDosenContent = meta.forumDosen; // sudah berupa HTML, biarkan apa adanya
    const mahasiswaList = meta.forumMahasiswa.map(m => `<li><strong>${escapeHtml(m.authorFullName)}</strong><div class="comment">${m.commentText}</div></li>`).join('');
    fullInputBlock = `<section><h2>Input Lengkap</h2>
      <details open>
        <summary><strong>Forum Dosen</strong></summary>
        <div class="forum-dosen">${forumDosenContent}</div>
      </details>
      <details>
        <summary><strong>Forum Mahasiswa (${meta.forumMahasiswa.length})</strong></summary>
        <ul class="forum-mahasiswa">${mahasiswaList}</ul>
      </details>
    </section>`;
  }

  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><title>${fileName}</title><style>${style}details{margin:12px 0}details summary{cursor:pointer}ul.forum-mahasiswa{list-style:disc;margin-left:20px}ul.forum-mahasiswa li{margin-bottom:12px}div.forum-dosen{background:#fff;border:1px solid #ddd;padding:12px;border-radius:6px}div.comment{margin-top:4px;background:#fff;border:1px solid #eee;padding:8px;border-radius:4px}</style></head><body>
  <nav><a href="index.html">&larr; Index</a></nav>
  <h1>Hasil: ${fileName}</h1>
  ${metaBlock}
  ${fullInputBlock}
  <section><h2>Konten Data</h2>${dataHtml}</section>
  <section><h2>Ringkasan Token</h2>${tokenTable}</section>
  <footer>Dibuat otomatis oleh generate_html.ts - ${new Date().toLocaleString('id-ID')}</footer>
  </body></html>`;
}

const indexEntries: { file: string; outputName: string }[] = [];

for (const file of files) {
  try {
    const fullPath = path.join(jsonDir, file);
    const root: Root = await Bun.file(fullPath).json();
    const baseName = file.replace(/\.json$/,'');
    const outName = `${baseName}.html`;
    const html = buildHtmlPage(file, root);
    writeFileSync(path.join(htmlDir, outName), html, 'utf-8');
    indexEntries.push({ file, outputName: outName });
    console.log(`Generated HTML: ${outName}`);
  } catch (e) {
    console.error(`Gagal memproses ${file}:`, e instanceof Error ? e.message : e);
  }
}

// Bangun index
const indexStyle = `body{font-family:Segoe UI,Arial,sans-serif;margin:32px;background:#ffffff;color:#222}h1{margin-top:0}ul{list-style:none;padding:0}li{margin:6px 0;padding:6px 10px;border:1px solid #e1e1e1;border-radius:6px;display:flex;justify-content:space-between;align-items:center}a{text-decoration:none;color:#0366d6}a:hover{text-decoration:underline}small{color:#666}`;
const indexHtml = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><title>Index Output HTML</title><style>${indexStyle}</style></head><body>
<h1>Daftar Output HTML (${indexEntries.length})</h1>
<p>Setiap halaman berisi konten <code>data</code> dan ringkasan token dari file JSON terkait.</p>
<ul>
${indexEntries.map(entry => `<li><span>${entry.file}</span><a href="${entry.outputName}" target="_blank">Buka &raquo;</a></li>`).join('')}
</ul>
<footer><small>Dibuat otomatis ${new Date().toLocaleString('id-ID')}</small></footer>
</body></html>`;

writeFileSync(path.join(htmlDir, 'index.html'), indexHtml, 'utf-8');
console.log(`Index ditulis ke ${path.join(htmlDir,'index.html')}`);
