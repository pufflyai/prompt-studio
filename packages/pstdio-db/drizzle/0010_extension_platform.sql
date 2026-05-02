CREATE TABLE "installed_extension_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"install_name" text NOT NULL,
	"extension_id" text NOT NULL,
	"namespace" text NOT NULL,
	"display_name" text NOT NULL,
	"version" text,
	"source_path" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_ref" text,
	"manifest_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_loaded_at" text,
	"last_error_json" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_extension_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"installed_extension_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"namespace" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"diagnostics_json" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_kv" (
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"namespace" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_kv_project_id_extension_id_scope_type_scope_id_key_pk" PRIMARY KEY("project_id","extension_id","scope_type","scope_id","key")
);
--> statement-breakpoint
CREATE TABLE "extension_collection_items" (
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"namespace" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"collection" text NOT NULL,
	"item_id" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_collection_items_project_id_extension_id_scope_type_scope_id_collection_item_id_pk" PRIMARY KEY("project_id","extension_id","scope_type","scope_id","collection","item_id")
);
--> statement-breakpoint
CREATE TABLE "extension_template_preferences" (
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"template_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_template_preferences_project_id_extension_id_template_key_pk" PRIMARY KEY("project_id","extension_id","template_key")
);
--> statement-breakpoint
CREATE TABLE "extension_skill_preferences" (
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"skill_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_skill_preferences_project_id_extension_id_skill_key_pk" PRIMARY KEY("project_id","extension_id","skill_key")
);
--> statement-breakpoint
ALTER TABLE "project_extension_instances" ADD CONSTRAINT "project_extension_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_extension_instances" ADD CONSTRAINT "project_extension_instances_installed_extension_id_installed_extension_sources_id_fk" FOREIGN KEY ("installed_extension_id") REFERENCES "public"."installed_extension_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_kv" ADD CONSTRAINT "extension_kv_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_collection_items" ADD CONSTRAINT "extension_collection_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_template_preferences" ADD CONSTRAINT "extension_template_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" ADD CONSTRAINT "extension_skill_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "installed_extension_sources_install_name_idx" ON "installed_extension_sources" USING btree ("install_name");--> statement-breakpoint
CREATE UNIQUE INDEX "installed_extension_sources_source_path_idx" ON "installed_extension_sources" USING btree ("source_path");--> statement-breakpoint
CREATE UNIQUE INDEX "project_extension_instances_project_extension_idx" ON "project_extension_instances" USING btree ("project_id","extension_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_extension_instances_project_namespace_idx" ON "project_extension_instances" USING btree ("project_id","namespace");--> statement-breakpoint
CREATE INDEX "project_extension_instances_installed_idx" ON "project_extension_instances" USING btree ("installed_extension_id");--> statement-breakpoint
CREATE INDEX "extension_kv_project_extension_idx" ON "extension_kv" USING btree ("project_id","extension_id");--> statement-breakpoint
CREATE INDEX "extension_kv_project_extension_scope_idx" ON "extension_kv" USING btree ("project_id","extension_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "extension_collection_items_project_extension_collection_idx" ON "extension_collection_items" USING btree ("project_id","extension_id","collection");--> statement-breakpoint
CREATE INDEX "extension_collection_items_project_extension_scope_collection_idx" ON "extension_collection_items" USING btree ("project_id","extension_id","scope_type","scope_id","collection");--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "type" text DEFAULT 'worktree' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "anchors_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "anchors_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_events" ALTER COLUMN "resource_type" TYPE text USING "resource_type"::text;--> statement-breakpoint
DROP TYPE "public"."activity_resource_type";
