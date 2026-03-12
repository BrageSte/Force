import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const pitchDir = path.join(repoRoot, "docs", "pitch");
const outDir = path.join(pitchDir, "pdf");

const jobs = [
  {
    html: path.join(pitchDir, "program-overview.html"),
    pdf: path.join(outDir, "krimblokk_programoversikt.pdf"),
  },
  {
    html: path.join(pitchDir, "test-battery.html"),
    pdf: path.join(outDir, "krimblokk_testoversikt.pdf"),
  },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function renderPdf(browser, htmlPath, pdfPath) {
  const page = await browser.newPage();
  const url = pathToFileURL(htmlPath).href;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.pdf({
    path: pdfPath,
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.close();
}

async function main() {
  await ensureDir(outDir);
  const browser = await chromium.launch({ headless: true });

  try {
    for (const job of jobs) {
      await renderPdf(browser, job.html, job.pdf);
      console.log(`Rendered ${path.relative(repoRoot, job.pdf)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
