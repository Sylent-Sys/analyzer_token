import { readdirSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Root } from './interface/response';
import ExcelJS from 'exceljs';

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

// Siapkan workbook Excel (satu sheet per output)
const workbook = new ExcelJS.Workbook();
workbook.creator = 'generate_html.ts';
workbook.created = new Date();

function sanitizeSheetName(name: string): string {
  // Excel sheet name max 31 chars, no : \\/ ? * [ ]
  let cleaned = name.replace(/[\\\/*:?\[\]]/g, '_');
  if (cleaned.length > 31) cleaned = cleaned.slice(0, 28) + '…';
  return cleaned || 'Sheet';
}

function addSheetForRoot(baseName: string, root: Root) {
  const sheetNameBase = sanitizeSheetName(baseName);
  // handle duplicate names
  let sheetName = sheetNameBase;
  let counter = 1;
  while (workbook.getWorksheet(sheetName)) {
    sheetName = sanitizeSheetName(`${sheetNameBase}_${counter++}`);
  }
  const ws = workbook.addWorksheet(sheetName);

  // Metadata ringkas di baris atas
  const meta = root.metadata?.input;
  ws.addRow(['file', baseName]);
  if (meta) {
    ws.addRow(['modeEmosi', meta.modeEmosi]);
    ws.addRow(['modeGayaBahasa', meta.modeGayaBahasa]);
    ws.addRow(['jumlahMahasiswa', meta.forumMahasiswa.length]);
    ws.addRow(['panjangForumDosen', meta.forumDosen.length]);
  }
  ws.addRow([]);

  // Header token
  ws.addRow(['key', 'inputToken', 'outputToken', 'totalToken', 'reasoningToken']).font = { bold: true } as any;
  const token: Record<string, any> = (root.metadata && (root.metadata as any).token) || {};
  for (const key of Object.keys(token)) {
    const obj = token[key];
    if (!obj || typeof obj !== 'object') continue;
    ws.addRow([
      key,
      typeof obj.inputTokenCount === 'number' ? obj.inputTokenCount : null,
      typeof obj.outputTokenCount === 'number' ? obj.outputTokenCount : null,
      typeof obj.totalTokenCount === 'number' ? obj.totalTokenCount : null,
      obj.outputTokenDetails && typeof obj.outputTokenDetails.reasoningTokenCount === 'number'
        ? obj.outputTokenDetails.reasoningTokenCount
        : null,
    ]);
  }

  // Tambahkan input lengkap & output summary (HTML di-strip)
  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const richLimit = 30000; // batas aman panjang konten excel (rich text)

  // Konversi HTML sederhana ke ExcelJS richText: dukung <b>/<strong>, <i>/<em>, <u>, <br>, <p>
  function htmlToRichText(html: string): ExcelJS.RichText[] {
    // Preprocessing: hapus script/style, normalisasi line breaks
    let work = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\r\n|\r/g, '\n');
    // Konversi tag blok menjadi line break
    work = work.replace(/<\/?(p|div|article|section|header|h[1-6])[^>]*>/gi, '\n');
    // Konversi <br>
    work = work.replace(/<br\s*\/?>/gi, '\n');
    // Normalisasi strong/em ke b/i
    work = work.replace(/<\s*strong\b[^>]*>/gi, '<b>').replace(/<\/strong>/gi, '</b>');
    work = work.replace(/<\s*em\b[^>]*>/gi, '<i>').replace(/<\/em>/gi, '</i>');
    // Hapus semua tag selain b/i/u (biarkan tag format)
    work = work.replace(/<(?!\/?(?:b|i|u)\b)[^>]+>/gi, '');
    // Tokenisasi berdasarkan tag format
    const segments: ExcelJS.RichText[] = [];
    let bold = false, italic = false, underline = false;
    const tagRegex = /<\/?(b|i|u)[^>]*>/gi;
    let lastIndex = 0; let match: RegExpExecArray | null;
    const pushText = (text: string) => {
      if (!text) return;
      // decode entities sederhana
      let cleaned = text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+$/g, ' ') // trailing whitespace normalize
        .replace(/\s+/g, ' ');
      if (!cleaned.trim()) return;
      segments.push({ text: cleaned, font: { bold, italic, underline } });
    };
    while ((match = tagRegex.exec(work)) !== null) {
      pushText(work.slice(lastIndex, match.index));
      const closing = match[0][1] === '/';
      const name = match[1];
      if (name === 'b') bold = !closing;
      if (name === 'i') italic = !closing;
      if (name === 'u') underline = !closing;
      lastIndex = tagRegex.lastIndex;
    }
    pushText(work.slice(lastIndex));
    // Split berdasarkan newline menjadi segmen terpisah
    const withBreaks: ExcelJS.RichText[] = [];
    for (const seg of segments) {
      const parts = seg.text.split('\n');
      parts.forEach((p, idx) => {
        if (p.trim()) withBreaks.push({ text: p.trim(), font: seg.font });
        if (idx < parts.length - 1) withBreaks.push({ text: '\n' });
      });
    }
    // Batasi panjang total
    let totalLen = 0; const trimmed: ExcelJS.RichText[] = [];
    for (const seg of withBreaks) {
      if (totalLen >= richLimit) break;
      const remaining = richLimit - totalLen;
      const txt = seg.text.length > remaining ? seg.text.slice(0, remaining) : seg.text;
      trimmed.push({ text: txt, font: seg.font });
      totalLen += txt.length;
    }
    if (!trimmed.length) trimmed.push({ text: '' });
    return trimmed;
  }
  ws.addRow([]);
  ws.addRow(['INPUT_LENGKAP']); ws.getRow(ws.lastRow!.number).font = { bold: true } as any;
  if (meta) {
    // Forum Dosen
    const fdRich = htmlToRichText(meta.forumDosen);
  ws.addRow(['ForumDosen_Text_Rich', '']);
  const richCellFD = ws.getCell(ws.lastRow!.number, 2);
  richCellFD.value = { richText: fdRich } as any;
  richCellFD.alignment = { wrapText: true } as any;
    ws.addRow(['ForumDosen_HTML_Raw', meta.forumDosen.slice(0, 30000)]);
    ws.addRow(['ForumDosen_Text_Plain', stripHtml(meta.forumDosen).slice(0, 30000)]);
    ws.addRow([]);
    ws.addRow(['ForumMahasiswa']); ws.getRow(ws.lastRow!.number).font = { bold: true } as any;
    ws.addRow(['authorFullName', 'commentText_rich', 'commentText_html', 'commentText_plain']); ws.getRow(ws.lastRow!.number).font = { bold: true } as any;
    for (const m of meta.forumMahasiswa) {
      const cRich = htmlToRichText(m.commentText);
      ws.addRow([m.authorFullName, { richText: cRich } as any, m.commentText.slice(0, 15000), stripHtml(m.commentText).slice(0, 15000)]);
      const richCell = ws.getCell(ws.lastRow!.number, 2);
      richCell.alignment = { wrapText: true } as any;
    }
  }
  ws.addRow([]);
  ws.addRow(['OUTPUT_DATA']); ws.getRow(ws.lastRow!.number).font = { bold: true } as any;
  if (typeof root.data === 'string') {
    const outRich = htmlToRichText(root.data);
  ws.addRow(['data_rich', '']);
  const dataRichCell = ws.getCell(ws.lastRow!.number, 2);
  dataRichCell.value = { richText: outRich } as any;
  dataRichCell.alignment = { wrapText: true } as any;
    ws.addRow(['data_html_raw', root.data.slice(0, richLimit)]);
    ws.addRow(['data_plain', stripHtml(root.data).slice(0, richLimit)]);
  } else {
    ws.addRow(['data_plain', '']);
  }

  // Format angka dan autosize
  ws.eachRow(row => {
    row.eachCell(cell => {
      if (typeof cell.value === 'number') cell.numFmt = '#,##0';
    });
  });
  if (ws.columns) {
    ws.columns.forEach(col => {
      let max = 10;
      (col as any)?.eachCell?.({ includeEmpty: true }, (c: any) => {
        const len = (c.value == null ? '' : String(c.value)).length;
        if (len > max) max = len;
      });
      col.width = Math.min(40, max + 2);
    });
  }
}

for (const file of files) {
  try {
    const fullPath = path.join(jsonDir, file);
    const root: Root = await Bun.file(fullPath).json();
    const baseName = file.replace(/\.json$/,'');
    const outName = `${baseName}.html`;
  const html = buildHtmlPage(file, root);
  // Tambahkan sheet Excel
  addSheetForRoot(baseName, root);
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

// Tulis workbook Excel
const excelPath = path.join(htmlDir, 'output_excel.xlsx');
await workbook.xlsx.writeFile(excelPath);
console.log(`Workbook Excel ditulis ke ${excelPath}`);
