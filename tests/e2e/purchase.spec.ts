import { expect, test, type Page } from "@playwright/test";

const PRODUCT = { id: "MN-MON-0002", name: "Vector Vision 34 4K UHD VA", price: "574,27" };
const DISCONTINUED = "MN-DOC-0017";

/** Lee la disponibilidad total que muestra el detalle ("En stock · N u."). */
async function shownAvailability(page: Page, id: string): Promise<number> {
  await page.goto(`/productos/${id}`);
  const badge = page
    .locator("main")
    .getByText(/ · \d+ u\./)
    .first();
  await expect(badge).toBeVisible();
  return Number((await badge.innerText()).match(/(\d+) u\./)![1]);
}

test("compra completa: carrito → checkout → confirmación → orden → stock descontado", async ({ page }) => {
  const before = await shownAvailability(page, PRODUCT.id);

  await page.getByRole("button", { name: "Agregar" }).first().click();
  await expect(page.getByRole("link", { name: /Carrito \(1 productos\)/ })).toBeVisible();
  await page.getByRole("button", { name: "Agregar" }).first().click();
  await expect(page.getByRole("link", { name: /Carrito \(2 productos\)/ })).toBeVisible();

  await page.goto("/carrito");
  await expect(page.getByTestId("cart-total")).toContainText("1.148,54");
  await page.getByRole("link", { name: "Ir al checkout" }).click();

  await page.getByLabel("Nombre y apellido").fill("Ana Pérez");
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("Teléfono").fill("099 123 456");
  await page.getByLabel("Dirección").fill("Av. 18 de Julio 1234");
  await page.getByRole("button", { name: "Revisar compra" }).click();

  await expect(page.getByRole("heading", { name: "Revisá y confirmá tu compra" })).toBeVisible();
  await expect(page.getByTestId("review-total")).toContainText("1.148,54");
  await page.getByRole("button", { name: /Confirmar compra por/ }).click();

  await expect(page.getByText("¡Compra confirmada!")).toBeVisible();
  const orderId = (
    await page
      .getByText(/^MN-ORD-\d{8}-\d{4}$/)
      .first()
      .innerText()
  ).trim();
  await expect(page.getByRole("link", { name: /Carrito \(0 productos\)/ })).toBeVisible();

  await page.goto("/ordenes");
  await expect(page.getByRole("link", { name: orderId })).toBeVisible();

  expect(await shownAvailability(page, PRODUCT.id)).toBe(before - 2);
});

test("no permite superar el stock disponible", async ({ page }) => {
  const available = await shownAvailability(page, "MN-MON-0003");
  await page.getByRole("button", { name: "Agregar" }).first().click();
  await expect(page.getByRole("link", { name: /Carrito \(1 productos\)/ })).toBeVisible();

  await page.goto("/carrito");
  const total = await page.getByTestId("cart-total").innerText();
  const qty = page.getByRole("spinbutton", { name: "Cantidad" });
  await qty.fill(String(available + 1));
  await qty.press("Enter");

  await expect(page.getByText(`Sólo hay ${available} unidades disponibles.`)).toBeVisible();
  await expect(page.getByTestId("cart-total")).toHaveText(total);
  await expect(qty).toHaveValue("1");
});

test("un producto discontinuado no se puede agregar", async ({ page }) => {
  await page.goto(`/productos/${DISCONTINUED}`);
  await expect(page.locator("main").getByText("Discontinuado").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Discontinuado" })).toBeDisabled();
});

test("el asistente informa que no está disponible sin GEMINI_API_KEY", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir asistente de compras" }).click();
  await expect(page.getByText(/El asistente no está configurado/)).toBeVisible();
  await expect(page.getByLabel("Mensaje para el asistente")).toBeDisabled();
});
