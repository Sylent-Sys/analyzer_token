import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'output');

// hanya ambil file TypeScript hasil generator yang diawali dengan `fetch_`
const files = readdirSync(outputDir).filter(file => file.endsWith('.ts') && file.startsWith('fetch_'));


// jalankan file secara paralel dengan batas konkurensi
const DEFAULT_CONCURRENCY = 5;
// allow override concurrency via env or --concurrency=N
let CONCURRENCY = DEFAULT_CONCURRENCY;
const concurrencyArg = process.argv.find(a => a.startsWith('--concurrency='));
if (concurrencyArg) {
  const v = Number(concurrencyArg.split('=')[1]);
  if (!Number.isNaN(v) && v > 0) CONCURRENCY = v;
} else if (process.env.CONCURRENCY) {
  const v = Number(process.env.CONCURRENCY);
  if (!Number.isNaN(v) && v > 0) CONCURRENCY = v;
}

// test mode: jalankan cuma sekali batch (hanya file pertama sebanyak CONCURRENCY)
const TEST_MODE = process.env.TEST_MODE === '1' || process.argv.includes('--test') || process.argv.includes('--once');

function runFile(filePath: string) {
  return new Promise<void>((resolve, _reject) => {
    console.log(`Menjalankan file: ${filePath}`);
    const child = spawn('bun', [filePath], { cwd: __dirname, stdio: 'inherit' });
    child.on('error', (err) => {
      console.error(`Gagal spawn proses untuk ${filePath}:`, err instanceof Error ? err.message : err);
      // jangan reject agar batch lanjut, resolve saja
      resolve();
    });
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`Selesai menjalankan file: ${filePath}`);
        resolve();
      } else {
        console.error(`Proses ${filePath} keluar dengan kode: ${code}`);
        // jangan hentikan batch pada error; resolve untuk lanjutkan
        resolve();
      }
    });
  });
}

async function runAllParallel(list: string[]) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= list.length) break;
  const file = list[i];
  if (!file) break;
  const filePath = path.join(outputDir, String(file));
      // run and wait
      try {
        await runFile(filePath);
      } catch (e) {
        // sudah ditangani di runFile, tapi tangkap defensif
        console.error(`Error tak terduga saat menjalankan ${filePath}:`, e instanceof Error ? e.message : e);
      }
    }
  });

  await Promise.all(workers);
}

(async () => {
  const listToProcess = TEST_MODE ? files.slice(0, Math.max(1, CONCURRENCY)) : files;
  if (TEST_MODE) console.log(`TEST MODE: hanya menjalankan batch pertama (${listToProcess.length} file)`);
  await runAllParallel(listToProcess);
  console.log('Semua file telah diproses.');
})();