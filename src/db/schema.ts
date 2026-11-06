import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSequence,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

// ---------- Catálogo (viene del dataset de la cátedra) ----------

export const brands = pgTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country"),
  positioning: text("positioning"),
});

export const categories = pgTable("categories", {
  subcategoryId: text("subcategory_id").primaryKey(),
  categoryId: text("category_id").notNull(),
  categoryName: text("category_name").notNull(),
  subcategoryName: text("subcategory_name").notNull(),
  department: text("department"),
  sortOrder: integer("sort_order"),
});

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id),
    brandName: text("brand_name").notNull(),
    category: text("category").notNull(),
    subcategory: text("subcategory").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull(),
    recommendedFor: text("recommended_for").array().notNull().default(sql`'{}'`),
    notRecommendedFor: text("not_recommended_for").array().notNull().default(sql`'{}'`),
    keyFeatures: text("key_features").array().notNull().default(sql`'{}'`),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    color: text("color"),
    weightKg: numeric("weight_kg", { mode: "number" }),
    widthCm: numeric("width_cm", { mode: "number" }),
    heightCm: numeric("height_cm", { mode: "number" }),
    depthCm: numeric("depth_cm", { mode: "number" }),
    warrantyMonths: integer("warranty_months"),
    returnDays: integer("return_days"),
    rating: numeric("rating", { mode: "number" }),
    reviewCount: integer("review_count"),
    launchDate: date("launch_date"),
    active: boolean("active").notNull(),
    imageUrl: text("image_url"),
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(name,'') || ' ' || coalesce(brand_name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(subcategory,'') || ' ' || coalesce(description,''))`,
    ),
  },
  (t) => [
    index("products_category_idx").on(t.category),
    index("products_search_tsv_idx").using("gin", t.searchTsv),
  ],
);

export const productSpecs = pgTable(
  "product_specs",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    attributeGroup: text("attribute_group").notNull(),
    attributeName: text("attribute_name").notNull(),
    valueText: text("value_text"),
    valueNumber: numeric("value_number", { mode: "number" }),
    unit: text("unit"),
  },
  (t) => [index("product_specs_product_idx").on(t.productId)],
);

export const prices = pgTable("prices", {
  productId: text("product_id")
    .primaryKey()
    .references(() => products.id),
  currency: text("currency").notNull(),
  listPrice: numeric("list_price", { precision: 10, scale: 2 }).notNull(),
  currentPrice: numeric("current_price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: integer("discount_percent").notNull().default(0),
  taxIncluded: boolean("tax_included").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const warehouses = pgTable("warehouses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  department: text("department").notNull(),
  country: text("country").notNull(),
  pickupEnabled: boolean("pickup_enabled").notNull(),
  shippingEnabled: boolean("shipping_enabled").notNull(),
});

export const inventory = pgTable(
  "inventory",
  {
    productId: text("product_id").notNull(),
    warehouseId: text("warehouse_id").notNull(),
    onHandQty: integer("on_hand_qty").notNull(),
    reservedQty: integer("reserved_qty").notNull(),
    availableQty: integer("available_qty").notNull(),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.warehouseId] }),
    check("inventory_available_non_negative", sql`${t.availableQty} >= 0`),
    check("inventory_on_hand_non_negative", sql`${t.onHandQty} >= 0`),
  ],
);

export const productRelations = pgTable(
  "product_relations",
  {
    productId: text("product_id").notNull(),
    relatedProductId: text("related_product_id").notNull(),
    relationType: text("relation_type").notNull(),
    strength: numeric("strength", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.relatedProductId, t.relationType] })],
);

export const productEmbeddings = pgTable(
  "product_embeddings",
  {
    productId: text("product_id")
      .primaryKey()
      .references(() => products.id),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
  },
  (t) => [index("product_embeddings_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

// ---------- Estado operacional ----------

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.productId] }), check("cart_quantity_positive", sql`${t.quantity} > 0`)],
);

export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1 });

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    status: text("status").notNull().default("confirmed"),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    deliveryMethod: text("delivery_method").notNull(),
    address: text("address"),
    department: text("department"),
    pickupWarehouseId: text("pickup_warehouse_id").references(() => warehouses.id),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("orders_delivery_method", sql`${t.deliveryMethod} in ('shipping','pickup')`),
    index("orders_session_idx").on(t.sessionId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    productId: text("product_id").notNull(),
    productName: text("product_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productId] })],
);

export const orderAllocations = pgTable(
  "order_allocations",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    productId: text("product_id").notNull(),
    warehouseId: text("warehouse_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productId, t.warehouseId] })],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    role: text("role").notNull(),
    parts: jsonb("parts").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_session_idx").on(t.sessionId, t.createdAt)],
);
