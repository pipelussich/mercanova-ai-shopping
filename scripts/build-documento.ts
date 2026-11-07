/**
 * Genera docs/entrega/MercaNova-documento-tecnico.pdf a partir de docs/entrega/documento.html
 * (renderiza los diagramas Mermaid en Chromium y numera las páginas).
 * Uso: npx tsx scripts/build-documento.ts
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

async function main() {
  const html = path.resolve("docs/entrega/documento.html");
  const out = path.resolve("docs/entrega/MercaNova-documento-tecnico.pdf");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
    await page.waitForSelector("body[data-ready='1']", { timeout: 60_000 });
    await page.pdf({
      path: out,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#888;padding:0 16mm;display:flex;justify-content:space-between">' +
        "<span>MercaNova · Sistemas de Soporte de Decisión</span>" +
        '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
    console.log(`PDF generado: ${out}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
