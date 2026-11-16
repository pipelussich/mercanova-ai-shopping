import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolResult } from "@/components/assistant/tool-result-cards";

const html = (errorText: string) =>
  renderToStaticMarkup(<ToolResult part={{ type: "tool-search_products", state: "output-error", errorText }} />);

describe("ToolResult con error", () => {
  it("no muestra los argumentos inválidos del modelo: el agente los corrige solo en el paso siguiente", () => {
    expect(html("Invalid input for tool search_products: Type validation failed")).toBe("");
  });

  it("muestra el aviso si la tool falló al ejecutarse", () => {
    expect(html("connection refused")).toContain("No pude completar una consulta");
  });
});
