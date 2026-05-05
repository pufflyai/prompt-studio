CREATE TYPE "public"."extension_source_kind" AS ENUM('local_path', 'git', 'registry', 'builtin');--> statement-breakpoint
CREATE TYPE "public"."extension_load_status" AS ENUM('pending', 'loaded', 'error', 'missing', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."extension_reload_status" AS ENUM('success', 'error', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."template_default_source" AS ENUM('project_template', 'extension_template');--> statement-breakpoint
CREATE TABLE "installed_extension_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"install_name" text NOT NULL,
	"extension_id" text NOT NULL,
	"display_name" text NOT NULL,
	"version" text,
	"source_kind" "extension_source_kind" NOT NULL,
	"source_path" text NOT NULL,
	"source_ref" text,
	"manifest_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_hash" text,
	"loaded_revision" text,
	"status" "extension_load_status" DEFAULT 'pending' NOT NULL,
	"last_loaded_at" text,
	"last_error_json" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "installed_ext_install_name_uq" ON "installed_extension_sources" USING btree ("install_name");--> statement-breakpoint
CREATE INDEX "installed_ext_extension_id_idx" ON "installed_extension_sources" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "installed_ext_status_idx" ON "installed_extension_sources" USING btree ("status");--> statement-breakpoint
CREATE TABLE "extension_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"installed_extension_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"namespace" text NOT NULL,
	"display_name_override" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"diagnostics_json" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_installed_extension_id_installed_extension_sources_id_fk" FOREIGN KEY ("installed_extension_id") REFERENCES "public"."installed_extension_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "extension_instances_scope_namespace_uq" ON "extension_instances" USING btree ("scope_type","scope_id","namespace");--> statement-breakpoint
CREATE UNIQUE INDEX "extension_instances_scope_installed_uq" ON "extension_instances" USING btree ("scope_type","scope_id","installed_extension_id");--> statement-breakpoint
CREATE INDEX "extension_instances_scope_idx" ON "extension_instances" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "extension_instances_installed_idx" ON "extension_instances" USING btree ("installed_extension_id");--> statement-breakpoint
CREATE TABLE "extension_reload_events" (
	"id" text PRIMARY KEY NOT NULL,
	"installed_extension_id" text NOT NULL,
	"previous_source_hash" text,
	"next_source_hash" text,
	"previous_revision" text,
	"next_revision" text,
	"status" "extension_reload_status" NOT NULL,
	"error_json" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extension_reload_events" ADD CONSTRAINT "extension_reload_events_installed_extension_id_installed_extension_sources_id_fk" FOREIGN KEY ("installed_extension_id") REFERENCES "public"."installed_extension_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_reload_events_installed_idx" ON "extension_reload_events" USING btree ("installed_extension_id","created_at");--> statement-breakpoint
CREATE TABLE "extension_kv" (
	"project_id" text,
	"extension_instance_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_kv_extension_instance_id_scope_type_scope_id_key_pk" PRIMARY KEY("extension_instance_id","scope_type","scope_id","key")
);
--> statement-breakpoint
ALTER TABLE "extension_kv" ADD CONSTRAINT "extension_kv_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_kv" ADD CONSTRAINT "extension_kv_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_kv_instance_scope_idx" ON "extension_kv" USING btree ("extension_instance_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "extension_kv_project_idx" ON "extension_kv" USING btree ("project_id");--> statement-breakpoint
CREATE TABLE "extension_collection_items" (
	"project_id" text,
	"extension_instance_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"collection" text NOT NULL,
	"item_id" text NOT NULL,
	"sort_order" integer,
	"value_json" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_collection_items_extension_instance_id_scope_type_scope_id_collection_item_id_pk" PRIMARY KEY("extension_instance_id","scope_type","scope_id","collection","item_id")
);
--> statement-breakpoint
ALTER TABLE "extension_collection_items" ADD CONSTRAINT "extension_collection_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_collection_items" ADD CONSTRAINT "extension_collection_items_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_collection_instance_idx" ON "extension_collection_items" USING btree ("extension_instance_id","collection");--> statement-breakpoint
CREATE INDEX "extension_collection_scope_idx" ON "extension_collection_items" USING btree ("extension_instance_id","scope_type","scope_id","collection");--> statement-breakpoint
CREATE INDEX "extension_collection_project_idx" ON "extension_collection_items" USING btree ("project_id");--> statement-breakpoint
CREATE TABLE "extension_template_preferences" (
	"project_id" text NOT NULL,
	"extension_instance_id" text NOT NULL,
	"template_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_name_override" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_template_preferences_project_id_extension_instance_id_template_key_pk" PRIMARY KEY("project_id","extension_instance_id","template_key")
);
--> statement-breakpoint
ALTER TABLE "extension_template_preferences" ADD CONSTRAINT "extension_template_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_template_preferences" ADD CONSTRAINT "extension_template_preferences_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_template_prefs_instance_idx" ON "extension_template_preferences" USING btree ("extension_instance_id");--> statement-breakpoint
CREATE TABLE "extension_skill_preferences" (
	"project_id" text NOT NULL,
	"extension_instance_id" text NOT NULL,
	"skill_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_name_override" text,
	"description_override" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_skill_preferences_project_id_extension_instance_id_skill_key_pk" PRIMARY KEY("project_id","extension_instance_id","skill_key")
);
--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" ADD CONSTRAINT "extension_skill_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" ADD CONSTRAINT "extension_skill_preferences_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_skill_prefs_instance_idx" ON "extension_skill_preferences" USING btree ("extension_instance_id");--> statement-breakpoint
CREATE TABLE "project_template_defaults" (
	"project_id" text NOT NULL,
	"template_type" text NOT NULL,
	"source" "template_default_source" NOT NULL,
	"template_id" text,
	"extension_instance_id" text,
	"template_key" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "project_template_defaults_project_id_template_type_pk" PRIMARY KEY("project_id","template_type")
);
--> statement-breakpoint
ALTER TABLE "project_template_defaults" ADD CONSTRAINT "project_template_defaults_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_defaults" ADD CONSTRAINT "project_template_defaults_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_defaults" ADD CONSTRAINT "project_template_defaults_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "skill_files" (
	"project_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"path" text NOT NULL,
	"file_id" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "skill_files_skill_id_path_pk" PRIMARY KEY("skill_id","path")
);
--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skill_files_skill_file_idx" ON "skill_files" USING btree ("skill_id","file_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "anchors_json" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
UPDATE "sessions" SET "anchors_json" = '[]'::jsonb WHERE "anchors_json" IS NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "anchors_json" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "anchors_json" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
UPDATE "workspaces" SET "anchors_json" = '[]'::jsonb WHERE "anchors_json" IS NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "anchors_json" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "source_extension_id" text;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_source_extension_id_installed_extension_sources_id_fk" FOREIGN KEY ("source_extension_id") REFERENCES "public"."installed_extension_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_source_extension_idx" ON "activity_events" USING btree ("source_extension_id");--> statement-breakpoint
ALTER TABLE "activity_events" ALTER COLUMN "resource_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."activity_resource_type";--> statement-breakpoint
INSERT INTO "project_template_defaults" ("project_id", "template_type", "source", "template_id", "updated_at")
SELECT "project_id", "template_type", 'project_template', "id", COALESCE("updated_at", "created_at")
FROM "templates"
WHERE "is_default" = true AND "deleted_at" IS NULL AND "project_id" IS NOT NULL
ON CONFLICT ("project_id", "template_type") DO NOTHING;--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "is_default";--> statement-breakpoint
INSERT INTO "skill_files" ("project_id", "skill_id", "path", "file_id", "created_at", "updated_at")
SELECT "project_id", "id", 'SKILL.md', "file_id", "created_at", "updated_at"
FROM "skills"
WHERE "file_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" DROP COLUMN IF EXISTS "file_id";--> statement-breakpoint
ALTER TABLE "skills" DROP COLUMN IF EXISTS "files_json";
