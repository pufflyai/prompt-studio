CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"source" text NOT NULL,
	"summary" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_events_project_created_id_idx" ON "activity_events" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_events_resource_created_id_idx" ON "activity_events" USING btree ("project_id","resource_type","resource_id","created_at","id");--> statement-breakpoint
