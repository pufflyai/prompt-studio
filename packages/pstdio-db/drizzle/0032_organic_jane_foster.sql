DROP INDEX "workspaces_project_workspace_shorthand_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_workspace_shorthand_idx" ON "workspaces" USING btree ("workspace_shorthand");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_shorthand_unique" UNIQUE("shorthand");