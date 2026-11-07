import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/assistant/rich-text";

const html = (text: string) => renderToStaticMarkup(<RichText text={text} />);

describe("RichText", () => {
  it("renderiza negrita e itálica", () => {
    expect(html("**Helix** y *Voltix*")).toBe("<strong>Helix</strong> y <em>Voltix</em>");
  });

  it("convierte links internos en enlaces", () => {
    expect(html("[Ir al checkout](/checkout)")).toContain('href="/checkout"');
  });

  it("no genera enlaces externos, tampoco los relativos al protocolo", () => {
    for (const href of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)"]) {
      const out = html(`[click](${href})`);
      expect(out).not.toContain("<a");
      expect(out).toContain("click");
    }
  });
});
