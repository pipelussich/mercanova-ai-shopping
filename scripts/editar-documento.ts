/**
 * Editor del documento técnico en el navegador: `npm run doc:editar` y abrir http://localhost:4321.
 * Se edita el texto haciendo click sobre la página; "Guardar" escribe docs/entrega/documento.html y regenera el PDF.
 * Los diagramas Mermaid no se editan acá y se guardan siempre tal cual están en el archivo.
 */
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const DIR = path.resolve("docs/entrega");
const FILE = path.join(DIR, "documento.html");
const PORT = Number(process.env.PORT ?? 4321);

const MERMAID_DIV = /<div class="mermaid">[\s\S]*?<\/div>/g;
const TYPES: Record<string, string> = { ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png" };

/** El archivo se parte en tres: lo de antes del <body>, el cuerpo y el script de Mermaid del final. */
function split(html: string) {
  const bodyStart = html.indexOf("<body>") + "<body>".length;
  const scriptStart = html.lastIndexOf("<script>");
  return { head: html.slice(0, bodyStart), body: html.slice(bodyStart, scriptStart), tail: html.slice(scriptStart) };
}

const EDITOR = `
<style>
  #editor-bar { position: fixed; top: 12px; right: 12px; z-index: 9999; display: flex; gap: 8px; align-items: center;
    font: 14px system-ui, sans-serif; background: #1f3a5f; color: #fff; padding: 8px 12px; border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,.2); }
  #editor-bar button { font: inherit; background: #fff; color: #1f3a5f; border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
  #editor-bar button:disabled { opacity: .5; cursor: default; }
  body { max-width: 178mm; margin: 70px auto 60px; padding: 0 16px; }
  [contenteditable]:focus { outline: none; }
  .mermaid { white-space: pre; font: 11px monospace; color: #888; background: #f4f6f8; padding: 8px; text-align: left; }
  .mermaid::before { content: "Diagrama (no se edita acá)"; display: block; font-weight: bold; margin-bottom: 4px; }
  section.cover { height: auto; }
</style>
<div id="editor-bar" contenteditable="false">
  <span id="editor-status">Editá el texto haciendo click donde quieras.</span>
  <button id="editor-save" type="button">Guardar</button>
</div>
<script>
  document.body.contentEditable = "true";
  document.querySelectorAll(".mermaid").forEach((d) => d.setAttribute("contenteditable", "false"));
  const status = document.getElementById("editor-status");
  const save = document.getElementById("editor-save");
  let dirty = false;
  document.body.addEventListener("input", () => { dirty = true; status.textContent = "Hay cambios sin guardar."; });
  window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });
  save.addEventListener("click", async () => {
    save.disabled = true;
    status.textContent = "Guardando y generando el PDF…";
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("#editor-bar, #editor-script, #editor-style").forEach((n) => n.remove());
    clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    clone.removeAttribute("contenteditable");
    const res = await fetch("/guardar", { method: "POST", body: clone.innerHTML });
    const msg = await res.text();
    status.textContent = msg;
    if (res.ok) dirty = false;
    save.disabled = false;
  });
</script>`;

function editorPage(): string {
  const { head, body } = split(readFileSync(FILE, "utf8"));
  // Sin la librería de Mermaid: los diagramas se ven como texto y no se tocan.
  const headNoMermaid = head.replace(/<script src="[^"]*mermaid[^"]*"><\/script>\n?/, "");
  const editor = EDITOR.replace("<style>", '<style id="editor-style">').replace("<script>", '<script id="editor-script">');
  return `${headNoMermaid}${body}${editor}\n</body>\n</html>\n`;
}

function saveBody(edited: string) {
  const original = readFileSync(FILE, "utf8");
  const { head, body, tail } = split(original);
  // Los diagramas vuelven exactamente como estaban en el archivo (el navegador cambiaría sus flechas a &gt;).
  const diagrams = body.match(MERMAID_DIV) ?? [];
  let i = 0;
  const merged = edited.replace(MERMAID_DIV, () => diagrams[i++] ?? "");
  if (i !== diagrams.length) throw new Error("No coinciden los diagramas del documento editado con los del archivo.");
  writeFileSync(FILE, `${head}${merged.trimEnd()}\n\n${tail}`);
}

createServer((req, res) => {
  if (req.method === "POST" && req.url === "/guardar") {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        saveBody(data);
      } catch (err) {
        res.writeHead(500).end(`No se pudo guardar: ${(err as Error).message}`);
        return;
      }
      execFile("npx", ["tsx", "scripts/build-documento.ts"], (err) => {
        if (err) res.writeHead(500).end("Se guardó el HTML, pero falló el PDF. Corré npx tsx scripts/build-documento.ts.");
        else res.writeHead(200).end("Guardado. PDF actualizado en docs/entrega/MercaNova-documento-tecnico.pdf");
      });
    });
    return;
  }
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(editorPage());
    return;
  }
  const file = path.join(DIR, path.normalize(url));
  if (!file.startsWith(DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  let content: Buffer;
  try {
    content = readFileSync(file);
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(content);
}).listen(PORT, "127.0.0.1", () => console.log(`Editor del documento en http://localhost:${PORT}`));
