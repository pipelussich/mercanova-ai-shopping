import { tool } from "ai";
import { z } from "zod";
import { CATEGORIES } from "@/domain/categories";
import { isDomainError } from "@/domain/errors";
import { compareProducts, getProduct, type ProductDetail } from "@/server/catalog/catalog-service";
import { searchProducts } from "@/server/search/search-service";
import { usd, type ToolContext } from "./context";

const category = z.enum(CATEGORIES as [string, ...string[]]);

function detail(p: ProductDetail) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    subcategory: p.subcategory,
    active: p.active,
    priceUsd: usd(p.priceCents),
    listPriceUsd: usd(p.listPriceCents),
    discountPercent: p.discountPercent,
    availableQty: p.availableQty,
    stockStatus: p.stockStatus,
    rating: p.rating,
    reviewCount: p.reviewCount,
    warrantyMonths: p.warrantyMonths,
    returnDays: p.returnDays,
    color: p.color,
    description: p.description,
    recommendedFor: p.recommendedFor,
    notRecommendedFor: p.notRecommendedFor,
    keyFeatures: p.keyFeatures,
    specs: p.specs,
    stockByWarehouse: p.stockByWarehouse.map((w) => ({
      warehouse: w.warehouseName,
      city: w.city,
      availableQty: w.availableQty,
    })),
  };
}

export function catalogTools(ctx: ToolContext) {
  return {
    search_products: tool({
      description:
        "Search the MercaNova catalog by meaning (natural language, any language) with optional structured filters. " +
        "Returns at most 6 active products with CURRENT price (USD) and stock from the database. " +
        "Use it whenever the user describes a need. Write `query` in English describing the use case and key features " +
        "(e.g. 'comfortable headphones for remote work and video calls with good microphone'). " +
        "Put budgets in maxPriceUsd instead of the query.",
      inputSchema: z.object({
        query: z.string().min(2).describe("What the user needs, in English"),
        category: category.optional().describe("Restrict to one catalog category when it is clear"),
        maxPriceUsd: z.number().positive().optional(),
        minPriceUsd: z.number().nonnegative().optional(),
        brand: z.string().optional(),
        inStockOnly: z.boolean().optional().describe("Only products with stock > 0"),
      }),
      execute: async (input) => {
        const { items, mode } = await searchProducts(
          ctx.db,
          {
            query: input.query,
            category: input.category,
            brand: input.brand,
            maxPriceCents: input.maxPriceUsd != null ? Math.round(input.maxPriceUsd * 100) : undefined,
            minPriceCents: input.minPriceUsd != null ? Math.round(input.minPriceUsd * 100) : undefined,
            inStockOnly: input.inStockOnly,
            limit: 6,
          },
          { embedQuery: ctx.embedQuery },
        );
        const results = items.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          priceUsd: usd(p.priceCents),
          availableQty: p.availableQty,
          stockStatus: p.stockStatus,
          rating: p.rating,
          recommendedFor: p.recommendedFor,
          notRecommendedFor: p.notRecommendedFor,
          keyFeatures: p.keyFeatures,
          matchReasons: p.matchReasons,
        }));
        return results.length
          ? { results, searchMode: mode }
          : { results, searchMode: mode, note: "NO_RESULTS" as const };
      },
    }),

    get_product_details: tool({
      description:
        "Get full, current details of one product by id: price (USD), stock per warehouse, specs, warranty, return days, " +
        "recommended / not recommended uses. Use before stating any specific fact about a product.",
      inputSchema: z.object({ productId: z.string().describe("Product id, e.g. MN-HDP-0002") }),
      execute: async ({ productId }) => {
        const p = await getProduct(ctx.db, productId);
        return p ? detail(p) : { error: "PRODUCT_NOT_FOUND" as const };
      },
    }),

    compare_products: tool({
      description:
        "Compare 2 to 4 products side by side using catalog data (price, stock, rating, warranty and aligned specs). " +
        "The user sees the comparison table rendered from this result.",
      inputSchema: z.object({ productIds: z.array(z.string()).min(2).max(4) }),
      execute: async ({ productIds }) => {
        try {
          const { products, rows } = await compareProducts(ctx.db, productIds);
          return {
            products: products.map((p) => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              priceUsd: usd(p.priceCents),
              availableQty: p.availableQty,
              stockStatus: p.stockStatus,
              rating: p.rating,
              warrantyMonths: p.warrantyMonths,
              active: p.active,
              recommendedFor: p.recommendedFor,
              notRecommendedFor: p.notRecommendedFor,
            })),
            rows,
          };
        } catch (err) {
          if (isDomainError(err)) return { error: err.code, message: err.message };
          throw err;
        }
      },
    }),

    get_related_products: tool({
      description:
        "Get related active products from the catalog: alternatives (use when a product is out of stock, discontinued " +
        "or over budget), accessories, or items often bought together.",
      inputSchema: z.object({
        productId: z.string(),
        relationType: z.enum(["alternative_to", "accessory_for", "often_bought_with"]).optional(),
      }),
      execute: async ({ productId, relationType }) => {
        const p = await getProduct(ctx.db, productId);
        if (!p) return { error: "PRODUCT_NOT_FOUND" as const, related: [] };
        return {
          related: p.related
            .filter((r) => !relationType || r.relationType === relationType)
            .slice(0, 6)
            .map((r) => ({
              relationType: r.relationType,
              strength: r.strength,
              product: {
                id: r.product.id,
                name: r.product.name,
                brand: r.product.brand,
                category: r.product.category,
                priceUsd: usd(r.product.priceCents),
                availableQty: r.product.availableQty,
                stockStatus: r.product.stockStatus,
              },
            })),
        };
      },
    }),
  };
}
