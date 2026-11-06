CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"positioning" text
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"session_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_session_id_product_id_pk" PRIMARY KEY("session_id","product_id"),
	CONSTRAINT "cart_quantity_positive" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"subcategory_id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"category_name" text NOT NULL,
	"subcategory_name" text NOT NULL,
	"department" text,
	"sort_order" integer
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"product_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"on_hand_qty" integer NOT NULL,
	"reserved_qty" integer NOT NULL,
	"available_qty" integer NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_product_id_warehouse_id_pk" PRIMARY KEY("product_id","warehouse_id"),
	CONSTRAINT "inventory_available_non_negative" CHECK ("inventory"."available_qty" >= 0),
	CONSTRAINT "inventory_on_hand_non_negative" CHECK ("inventory"."on_hand_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_allocations" (
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_allocations_order_id_product_id_warehouse_id_pk" PRIMARY KEY("order_id","product_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_items_order_id_product_id_pk" PRIMARY KEY("order_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"delivery_method" text NOT NULL,
	"address" text,
	"department" text,
	"pickup_warehouse_id" text,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "orders_delivery_method" CHECK ("orders"."delivery_method" in ('shipping','pickup'))
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"product_id" text PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"list_price" numeric(10, 2) NOT NULL,
	"current_price" numeric(10, 2) NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"tax_included" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_embeddings" (
	"product_id" text PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_relations" (
	"product_id" text NOT NULL,
	"related_product_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"strength" numeric NOT NULL,
	CONSTRAINT "product_relations_product_id_related_product_id_relation_type_pk" PRIMARY KEY("product_id","related_product_id","relation_type")
);
--> statement-breakpoint
CREATE TABLE "product_specs" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"attribute_group" text NOT NULL,
	"attribute_name" text NOT NULL,
	"value_text" text,
	"value_number" numeric,
	"unit" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"brand_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"short_description" text NOT NULL,
	"description" text NOT NULL,
	"recommended_for" text[] DEFAULT '{}' NOT NULL,
	"not_recommended_for" text[] DEFAULT '{}' NOT NULL,
	"key_features" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"color" text,
	"weight_kg" numeric,
	"width_cm" numeric,
	"height_cm" numeric,
	"depth_cm" numeric,
	"warranty_months" integer,
	"return_days" integer,
	"rating" numeric,
	"review_count" integer,
	"launch_date" date,
	"active" boolean NOT NULL,
	"image_url" text,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(brand_name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(subcategory,'') || ' ' || coalesce(description,''))) STORED
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"department" text NOT NULL,
	"country" text NOT NULL,
	"pickup_enabled" boolean NOT NULL,
	"shipping_enabled" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_allocations" ADD CONSTRAINT "order_allocations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_warehouse_id_warehouses_id_fk" FOREIGN KEY ("pickup_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_embeddings" ADD CONSTRAINT "product_embeddings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specs" ADD CONSTRAINT "product_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_session_idx" ON "orders" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "product_embeddings_hnsw_idx" ON "product_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "product_specs_product_idx" ON "product_specs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_search_tsv_idx" ON "products" USING gin ("search_tsv");