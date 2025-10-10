import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Root } from "./interface/response";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, "output_json");

// hanya ambil file TypeScript hasil generator yang diawali dengan `fetch_`
const files = readdirSync(outputDir).filter(
  (file) => file.endsWith(".json") && file.startsWith("response_")
);

const allResponseData: Root[] = [];
for (const file of files) {
  const filePath = path.join(outputDir, file);
  console.log(`Membaca file: ${filePath}`);
  try {
    const fileContent = readFileSync(filePath, "utf-8");
    const jsonData: Root = JSON.parse(fileContent);
    allResponseData.push(jsonData);
    console.log(`Selesai membaca file: ${filePath}`);
  } catch (err) {
    // tidak menghentikan batch jika salah satu file error; laporkan saja
    console.error(
      `Gagal membaca atau mengurai ${filePath}:`,
      err instanceof Error ? err.message : err
    );
  }
}

console.log(`Total file yang diproses: ${allResponseData.length}`);
console.log("Semua data telah dikumpulkan.");
