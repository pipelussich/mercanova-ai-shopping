import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

/**
 * Lector mínimo de .xlsx para el dataset de la cátedra.
 * El archivo fue generado con OpenXML SDK (XML con prefijos `x:`), que exceljs no soporta;
 * por eso se parsea directo: zip → workbook.xml (hojas) → worksheets (celdas inline/num/bool).
 */

export type Cell = string | number | boolean | null;
export type SheetRow = Record<string, Cell>;
export type Workbook = Record<string, SheetRow[]>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  isArray: (name) => ["sheet", "row", "c", "Relationship", "si"].includes(name),
});

/** Serial de fecha de Excel (sistema 1900) → Date UTC. */
export function excelSerialToDate(serial: number): Date {
  const ms = Math.round((serial - 25569) * 86_400_000);
  return new Date(ms);
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as object)) return String((node as { "#text": unknown })["#text"]);
  return "";
}

function cellValue(c: Record<string, unknown>, shared: string[]): Cell {
  const type = c["@t"] as string | undefined;
  if (type === "inlineStr") {
    const is = c.is as { t?: unknown } | undefined;
    return text(is?.t) || null;
  }
  const raw = text(c.v);
  if (raw === "") return null;
  switch (type) {
    case "s":
      return shared[Number(raw)] ?? null;
    case "str":
      return raw;
    case "b":
      return raw === "1" || raw === "true";
    default:
      return Number(raw);
  }
}

export async function readWorkbook(filePath: string): Promise<Workbook> {
  const files = unzipSync(new Uint8Array(await readFile(filePath)));
  const get = (p: string) => {
    const f = files[p.replace(/^\//, "")];
    if (!f) throw new Error(`xlsx inválido: falta ${p}`);
    return parser.parse(strFromU8(f));
  };

  const shared: string[] = files["xl/sharedStrings.xml"]
    ? ((get("xl/sharedStrings.xml").sst?.si ?? []) as { t?: unknown }[]).map((si) => text(si.t))
    : [];

  const rels = get("xl/_rels/workbook.xml.rels").Relationships.Relationship as Record<string, string>[];
  const targetById = new Map(rels.map((r) => [r["@Id"], r["@Target"]]));
  const sheets = get("xl/workbook.xml").workbook.sheets.sheet as Record<string, string>[];

  const workbook: Workbook = {};
  for (const s of sheets) {
    const target = targetById.get(s["@id"]);
    if (!target) throw new Error(`xlsx inválido: hoja ${s["@name"]} sin destino`);
    const sheetPath = target.startsWith("/") ? target : `xl/${target}`;
    const rows = (get(sheetPath).worksheet.sheetData?.row ?? []) as { c?: Record<string, unknown>[] }[];
    const grid = rows.map((row) => {
      const values: Cell[] = [];
      for (const c of row.c ?? []) values[columnIndex(String(c["@r"]))] = cellValue(c, shared);
      return values;
    });
    const header = (grid[0] ?? []).map((h) => (h == null ? "" : String(h).trim()));
    workbook[s["@name"]] = grid
      .slice(1)
      .filter((r) => r.some((v) => v != null))
      .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? null]).filter(([h]) => h)) as SheetRow);
  }
  return workbook;
}
