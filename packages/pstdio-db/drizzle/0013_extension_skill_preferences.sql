CREATE TABLE IF NOT EXISTS "extension_skill_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"skill_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" ADD CONSTRAINT "extension_skill_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "extension_skill_preferences_key_idx" ON "extension_skill_preferences" USING btree ("project_id","extension_id","skill_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_skill_preferences_project_idx" ON "extension_skill_preferences" USING btree ("project_id");
--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "origin_extension_id" text;
--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "origin_template_key" text;
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "origin_extension_id" text;
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "origin_skill_key" text;
