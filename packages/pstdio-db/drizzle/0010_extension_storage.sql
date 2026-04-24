CREATE TABLE "extension_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"display_name" text NOT NULL,
	"source_kind" text NOT NULL,
	"package_name" text,
	"package_version" text,
	"local_path" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_kv" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_collection_items" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"collection" text NOT NULL,
	"item_id" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_template_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"template_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "extension_kv" ADD CONSTRAINT "extension_kv_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "extension_collection_items" ADD CONSTRAINT "extension_collection_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "extension_template_preferences" ADD CONSTRAINT "extension_template_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "extension_instances_project_extension_idx" ON "extension_instances" USING btree ("project_id","extension_id");
--> statement-breakpoint
CREATE INDEX "extension_instances_project_idx" ON "extension_instances" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "extension_kv_scope_key_idx" ON "extension_kv" USING btree ("project_id","extension_id","scope_type","scope_id","key");
--> statement-breakpoint
CREATE INDEX "extension_kv_project_idx" ON "extension_kv" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "extension_collection_items_scope_item_idx" ON "extension_collection_items" USING btree ("project_id","extension_id","scope_type","scope_id","collection","item_id");
--> statement-breakpoint
CREATE INDEX "extension_collection_items_project_idx" ON "extension_collection_items" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "extension_template_preferences_key_idx" ON "extension_template_preferences" USING btree ("project_id","extension_id","template_key");
--> statement-breakpoint
CREATE INDEX "extension_template_preferences_project_idx" ON "extension_template_preferences" USING btree ("project_id");
