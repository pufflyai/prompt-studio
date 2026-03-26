CREATE TABLE "attempt_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_default" boolean NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD COLUMN "attempt_status_id" text;--> statement-breakpoint
ALTER TABLE "attempt_statuses" ADD CONSTRAINT "attempt_statuses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_statuses_project_name_idx" ON "attempt_statuses" USING btree ("project_id","name");--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD CONSTRAINT "workspace_sessions_attempt_status_id_attempt_statuses_id_fk" FOREIGN KEY ("attempt_status_id") REFERENCES "public"."attempt_statuses"("id") ON DELETE set null ON UPDATE no action;