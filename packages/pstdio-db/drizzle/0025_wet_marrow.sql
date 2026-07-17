CREATE TABLE "synced_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"shorthand" text NOT NULL,
	"title" text NOT NULL,
	"parent_id" text
);
--> statement-breakpoint
ALTER TABLE "synced_tickets" ADD CONSTRAINT "synced_tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "synced_tickets_project_idx" ON "synced_tickets" USING btree ("project_id");