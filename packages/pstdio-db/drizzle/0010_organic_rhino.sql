CREATE TABLE "preferences" (
	"scope" text NOT NULL,
	"scope_id" text NOT NULL,
	"extension_id" text DEFAULT '' NOT NULL,
	"key" text NOT NULL,
	"sync" text NOT NULL,
	"value" jsonb,
	"project_id" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "preferences_scope_scope_id_extension_id_key_pk" PRIMARY KEY("scope","scope_id","extension_id","key")
);
--> statement-breakpoint
DROP TABLE "local_environment" CASCADE;--> statement-breakpoint
DROP TABLE "extension_automation_preferences" CASCADE;--> statement-breakpoint
DROP TABLE "extension_settings" CASCADE;--> statement-breakpoint
DROP TABLE "extension_skill_preferences" CASCADE;--> statement-breakpoint
DROP TABLE "settings" CASCADE;--> statement-breakpoint
DROP TABLE "webview_preferences" CASCADE;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preferences_extension_idx" ON "preferences" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "preferences_project_idx" ON "preferences" USING btree ("project_id");