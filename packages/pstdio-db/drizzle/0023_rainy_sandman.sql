CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source" text NOT NULL,
	"origin" text NOT NULL,
	"source_extension_id" text,
	"actor_type" text,
	"actor_id" text,
	"title" text NOT NULL,
	"body" text,
	"kind" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"target_json" jsonb,
	"related_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata_json" jsonb,
	"dedupe_key" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"read_at" text,
	"resolved_at" text,
	"snoozed_until" text,
	"expires_at" text
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_project_status_updated_idx" ON "notifications" USING btree ("project_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "notifications_project_priority_status_idx" ON "notifications" USING btree ("project_id","priority","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_project_live_dedupe_unique" ON "notifications" USING btree ("project_id","dedupe_key") WHERE "notifications"."dedupe_key" IS NOT NULL AND "notifications"."status" IN ('open', 'read', 'snoozed');--> statement-breakpoint
CREATE INDEX "notifications_project_source_status_idx" ON "notifications" USING btree ("project_id","source_extension_id","status");