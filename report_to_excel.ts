import { readdirSync, readFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import type { Root } from './interface/response';

// --- Pricing configuration (cost per 1M tokens) ---
// Adjust these numbers as provider pricing changes.
// Example based on screenshot provided: Input $0.25, Cached Input $0.03, Output $2.00 per 1M tokens.
const PRICE_PER_M_INPUT = 0.25; // regular input tokens per 1M
const PRICE_PER_M_CACHED_INPUT = 0.03; // cached input tokens per 1M (if you later distinguish)
const PRICE_PER_M_OUTPUT = 2.0; // output tokens per 1M

// Helper to compute cost from a raw token count.
function costFromTokens(tokens: number | null | undefined, pricePerMillion: number): number | null {
  if (typeof tokens !== 'number' || !isFinite(tokens)) return null;
  return (tokens / 1_000_000) * pricePerMillion;
}

// --- FX rate (USD -> IDR) ---
// Ganti sesuai kurs terkini. Bisa juga nanti dibaca dari ENV.
const EXCHANGE_RATE_USD_TO_IDR = 16000; // contoh kurs 1 USD = 16,000 IDR

function usdToIdr(valueUsd: number | null | undefined): number | null {
  if (typeof valueUsd !== 'number' || !isFinite(valueUsd)) return null;
  return valueUsd * EXCHANGE_RATE_USD_TO_IDR;
}

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'output_json');
const outXlsx = path.join(__dirname, 'report_tokens.xlsx');

const files = readdirSync(outputDir).filter((f) => f.endsWith('.json') && f.startsWith('response_'));

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Token');

// Kumpulkan semua key token dari seluruh file supaya header dinamis
const allKeys = new Set<string>();
const parsedFiles: { file: string; tokenObj?: Record<string, any> }[] = [];

for (const file of files) {
  const filePath = path.join(outputDir, file);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data: Root = JSON.parse(raw);
    const token = data.metadata?.token as Record<string, any> | undefined;
    parsedFiles.push({ file, tokenObj: token });
    if (token) {
      Object.keys(token).forEach((k) => allKeys.add(k));
    }
  } catch (err) {
    console.error(`Gagal memproses ${filePath}:`, err instanceof Error ? err.message : err);
    parsedFiles.push({ file });
  }
}

const sortedKeys = Array.from(allKeys).sort();

// Build header: nama_file then for each key two columns: key.input and key.output
const header: string[] = ['nama_file'];
for (const k of sortedKeys) {
  header.push(`${k}.input`);
  header.push(`${k}.output`);
}
const headerRow = sheet.addRow(header);
// style header (bold)
headerRow.font = { bold: true };

// Write one row per file
for (const pf of parsedFiles) {
  const row: any[] = [pf.file];
  const token = pf.tokenObj;
  for (const k of sortedKeys) {
    if (token && typeof token[k] === 'object') {
      const obj = token[k];
      const inputTokenCount = typeof obj?.inputTokenCount === 'number' ? obj.inputTokenCount : null;
      const outputTokenCount = typeof obj?.outputTokenCount === 'number' ? obj.outputTokenCount : null;
      row.push(inputTokenCount);
      row.push(outputTokenCount);
    } else {
      row.push(null, null);
    }
  }
  sheet.addRow(row);
}

// format numeric cells in Token sheet (integer token counts)
for (let r = 2; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r);
  row.eachCell((cell) => {
    if (typeof cell.value === 'number' && Number.isInteger(cell.value)) {
      cell.numFmt = '#,##0';
    }
  });
}

// autosize Token columns
for (let i = 1; i <= sheet.columnCount; i++) {
  const col = sheet.getColumn(i);
  let maxLength = 10;
  col.eachCell({ includeEmpty: true }, (cell) => {
    const v = cell.value;
    const s = v == null ? '' : String(v);
    if (s.length > maxLength) maxLength = s.length;
  });
  col.width = Math.min(50, maxLength + 2);
}

// --- Analytics (sheet kedua) ---
const analyticsSheet = workbook.addWorksheet('Analitik');

// Ringkasan per-kunci: terjemahan ke Bahasa Indonesia untuk memudahkan pembaca
analyticsSheet.addRow(['Ringkasan per-kunci']);
const analyticsHeader = [
  'kunci',
  'jumlah_file_berisi',
  'total_input_token',
  'total_output_token',
  'total_biaya_input',
  'total_biaya_output',
  'total_biaya_input_idr',
  'total_biaya_output_idr',
  'rata2_input',
  'rata2_output',
  'rata2_biaya_input',
  'rata2_biaya_output',
  'rata2_biaya_input_idr',
  'rata2_biaya_output_idr',
  'maks_input',
  'file_maks_input',
  'biaya_maks_input',
  'biaya_maks_input_idr',
  'maks_output',
  'file_maks_output',
  'biaya_maks_output',
  'biaya_maks_output_idr',
];
const analyticsHeaderRow = analyticsSheet.addRow(analyticsHeader);
analyticsHeaderRow.font = { bold: true };

for (const k of sortedKeys) {
  let totalInput = 0;
  let totalOutput = 0;
  let countInput = 0;
  let countOutput = 0;
  let maxInput = -Infinity;
  let maxInputFile: string | null = null;
  let maxOutput = -Infinity;
  let maxOutputFile: string | null = null;
  let maxInputCost = -Infinity;
  let maxOutputCost = -Infinity;

  for (const pf of parsedFiles) {
    const tok = pf.tokenObj?.[k];
    const inV = typeof tok?.inputTokenCount === 'number' ? tok.inputTokenCount : null;
    const outV = typeof tok?.outputTokenCount === 'number' ? tok.outputTokenCount : null;
    if (typeof inV === 'number') {
      totalInput += inV;
      countInput += 1;
      const inCost = costFromTokens(inV, PRICE_PER_M_INPUT);
      if (inV > maxInput) {
        maxInput = inV;
        maxInputFile = pf.file;
        maxInputCost = inCost ?? maxInputCost;
      }
    }
    if (typeof outV === 'number') {
      totalOutput += outV;
      countOutput += 1;
      const outCost = costFromTokens(outV, PRICE_PER_M_OUTPUT);
      if (outV > maxOutput) {
        maxOutput = outV;
        maxOutputFile = pf.file;
        maxOutputCost = outCost ?? maxOutputCost;
      }
    }
  }

  const avgInput = countInput > 0 ? totalInput / countInput : null;
  const avgOutput = countOutput > 0 ? totalOutput / countOutput : null;
  const totalInputCost = costFromTokens(totalInput, PRICE_PER_M_INPUT) ?? 0;
  const totalOutputCost = costFromTokens(totalOutput, PRICE_PER_M_OUTPUT) ?? 0;
  const avgInputCost = avgInput != null ? costFromTokens(avgInput, PRICE_PER_M_INPUT) : null;
  const avgOutputCost = avgOutput != null ? costFromTokens(avgOutput, PRICE_PER_M_OUTPUT) : null;
  const totalInputCostIdr = usdToIdr(totalInputCost) ?? null;
  const totalOutputCostIdr = usdToIdr(totalOutputCost) ?? null;
  const avgInputCostIdr = usdToIdr(avgInputCost ?? null);
  const avgOutputCostIdr = usdToIdr(avgOutputCost ?? null);
  const maxInputCostIdr = usdToIdr(isFinite(maxInputCost) ? maxInputCost : null);
  const maxOutputCostIdr = usdToIdr(isFinite(maxOutputCost) ? maxOutputCost : null);

  analyticsSheet.addRow([
    k,
    Math.max(countInput, countOutput),
    totalInput || 0,
    totalOutput || 0,
    totalInputCost,
    totalOutputCost,
    totalInputCostIdr,
    totalOutputCostIdr,
    avgInput ?? null,
    avgOutput ?? null,
    avgInputCost ?? null,
    avgOutputCost ?? null,
    avgInputCostIdr ?? null,
    avgOutputCostIdr ?? null,
    isFinite(maxInput) ? maxInput : null,
    maxInputFile,
    isFinite(maxInputCost) ? maxInputCost : null,
    maxInputCostIdr ?? null,
    isFinite(maxOutput) ? maxOutput : null,
    maxOutputFile,
    isFinite(maxOutputCost) ? maxOutputCost : null,
    maxOutputCostIdr ?? null,
  ]);
}

// Overall summary
analyticsSheet.addRow([]);
analyticsSheet.addRow(['Ringkasan keseluruhan']);
const totalsPerFile: { file: string; totalInput: number; totalOutput: number; totalAll: number }[] = [];
for (const pf of parsedFiles) {
  let sumIn = 0;
  let sumOut = 0;
  for (const k of sortedKeys) {
    const tok = pf.tokenObj?.[k];
    const inV = typeof tok?.inputTokenCount === 'number' ? tok.inputTokenCount : 0;
    const outV = typeof tok?.outputTokenCount === 'number' ? tok.outputTokenCount : 0;
    sumIn += inV;
    sumOut += outV;
  }
  totalsPerFile.push({ file: pf.file, totalInput: sumIn, totalOutput: sumOut, totalAll: sumIn + sumOut });
}

const totalFiles = parsedFiles.length;
const totalInputAll = totalsPerFile.reduce((s, r) => s + r.totalInput, 0);
const totalOutputAll = totalsPerFile.reduce((s, r) => s + r.totalOutput, 0);
const avgInputPerFile = totalFiles > 0 ? totalInputAll / totalFiles : 0;
const avgOutputPerFile = totalFiles > 0 ? totalOutputAll / totalFiles : 0;
// Cost aggregates
const totalInputCostAll = costFromTokens(totalInputAll, PRICE_PER_M_INPUT) ?? 0;
const totalOutputCostAll = costFromTokens(totalOutputAll, PRICE_PER_M_OUTPUT) ?? 0;
const totalCostAll = totalInputCostAll + totalOutputCostAll;
const avgInputCostPerFile = totalFiles > 0 ? totalInputCostAll / totalFiles : 0;
const avgOutputCostPerFile = totalFiles > 0 ? totalOutputCostAll / totalFiles : 0;
const avgCostPerFile = totalFiles > 0 ? totalCostAll / totalFiles : 0;
// IDR conversions
const totalInputCostAllIdr = usdToIdr(totalInputCostAll) ?? 0;
const totalOutputCostAllIdr = usdToIdr(totalOutputCostAll) ?? 0;
const totalCostAllIdr = usdToIdr(totalCostAll) ?? 0;
const avgInputCostPerFileIdr = usdToIdr(avgInputCostPerFile) ?? 0;
const avgOutputCostPerFileIdr = usdToIdr(avgOutputCostPerFile) ?? 0;
const avgCostPerFileIdr = usdToIdr(avgCostPerFile) ?? 0;

const topFiles = totalsPerFile.sort((a, b) => b.totalAll - a.totalAll).slice(0, 5).map((r) => `${r.file}(${r.totalAll})`).join(', ');

analyticsSheet.addRow(['']);
analyticsSheet.addRow(['Ringkasan keseluruhan']);
analyticsSheet.addRow(['jumlah_file', totalFiles]);
analyticsSheet.addRow(['total_input_token', totalInputAll]);
analyticsSheet.addRow(['total_output_token', totalOutputAll]);
analyticsSheet.addRow(['total_biaya_input', totalInputCostAll]);
analyticsSheet.addRow(['total_biaya_output', totalOutputCostAll]);
analyticsSheet.addRow(['total_biaya_semua', totalCostAll]);
analyticsSheet.addRow(['total_biaya_input_idr', totalInputCostAllIdr]);
analyticsSheet.addRow(['total_biaya_output_idr', totalOutputCostAllIdr]);
analyticsSheet.addRow(['total_biaya_semua_idr', totalCostAllIdr]);
analyticsSheet.addRow(['rata2_input_per_file', avgInputPerFile]);
analyticsSheet.addRow(['rata2_output_per_file', avgOutputPerFile]);
analyticsSheet.addRow(['rata2_biaya_input_per_file', avgInputCostPerFile]);
analyticsSheet.addRow(['rata2_biaya_output_per_file', avgOutputCostPerFile]);
analyticsSheet.addRow(['rata2_biaya_total_per_file', avgCostPerFile]);
analyticsSheet.addRow(['rata2_biaya_input_per_file_idr', avgInputCostPerFileIdr]);
analyticsSheet.addRow(['rata2_biaya_output_per_file_idr', avgOutputCostPerFileIdr]);
analyticsSheet.addRow(['rata2_biaya_total_per_file_idr', avgCostPerFileIdr]);
analyticsSheet.addRow(['file_teratas_berdasarkan_total_token', topFiles]);

// Hitung juga rata-rata per entry (non-null input/output occurrences)
let countInputEntries = 0;
let countOutputEntries = 0;
for (const pf of parsedFiles) {
  for (const k of sortedKeys) {
    const tok = pf.tokenObj?.[k];
    if (typeof tok?.inputTokenCount === 'number') countInputEntries += 1;
    if (typeof tok?.outputTokenCount === 'number') countOutputEntries += 1;
  }
}
const avgInputPerEntry = countInputEntries > 0 ? totalInputAll / countInputEntries : null;
const avgOutputPerEntry = countOutputEntries > 0 ? totalOutputAll / countOutputEntries : null;
analyticsSheet.addRow(['jumlah_entry_input', countInputEntries]);
analyticsSheet.addRow(['jumlah_entry_output', countOutputEntries]);
analyticsSheet.addRow(['rata2_input_per_entry', avgInputPerEntry]);
analyticsSheet.addRow(['rata2_output_per_entry', avgOutputPerEntry]);

// Format numeric cells in Analitik sheet
// Determine cost columns by header names containing 'biaya'
const biayaHeaders = new Set<string>();
analyticsSheet.getRow(2).eachCell((cell) => {
  if (typeof cell.value === 'string' && cell.value.toLowerCase().includes('biaya')) {
    biayaHeaders.add(String(cell.value));
  }
});

for (let r = 2; r <= analyticsSheet.rowCount; r++) {
  const row = analyticsSheet.getRow(r);
  row.eachCell((cell) => {
    const v = cell.value;
    if (typeof v === 'number') {
      // Differentiate token counts vs costs by column header name (row 2)
      const headerCell = analyticsSheet.getRow(2).getCell(cell.col);
      const headerVal = headerCell.value;
      if (typeof headerVal === 'string' && headerVal.toLowerCase().includes('biaya')) {
        if (headerVal.toLowerCase().includes('idr')) {
          // Format IDR (Rp) - usually no decimals or 2 decimals; choose 0 decimals for large values
          cell.numFmt = '"Rp" #,##0';
        } else {
          cell.numFmt = '[$$-409]#,##0.0000';
        }
      } else {
        // token or average token values
        cell.numFmt = '#,##0.00';
      }
    }
  });
}

// autosize Analitik columns
for (let i = 1; i <= analyticsSheet.columnCount; i++) {
  const col = analyticsSheet.getColumn(i);
  let maxLength = 10;
  col.eachCell({ includeEmpty: true }, (cell) => {
    const v = cell.value;
    const s = v == null ? '' : String(v);
    if (s.length > maxLength) maxLength = s.length;
  });
  col.width = Math.min(60, maxLength + 4);
}

// pastikan direktori hasil exist (file akan ditulis di repo root)
try {
  const dir = path.dirname(outXlsx);
  mkdirSync(dir, { recursive: true });
} catch {}

try {
  await workbook.xlsx.writeFile(outXlsx);
  console.log(`Report ditulis ke ${outXlsx}`);
} catch (err) {
  const code = err && (err as any).code;
  if (code === 'EBUSY' || code === 'EACCES') {
    const altPath = path.join(__dirname, `report_tokens_${Date.now()}.xlsx`);
    try {
      await workbook.xlsx.writeFile(altPath);
      console.log(`File target terkunci; menulis ke alternatif: ${altPath}`);
    } catch (err2) {
      console.error('Gagal menulis file alternatif:', err2 instanceof Error ? err2.message : err2);
      throw err2;
    }
  } else {
    console.error('Gagal menulis file:', err instanceof Error ? err.message : err);
    throw err;
  }
}
