ALTER TABLE "workspaces" ALTER COLUMN "workspace_shorthand" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" DROP COLUMN "repo_id";