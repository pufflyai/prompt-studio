ALTER TABLE "sessions" ADD COLUMN "usage_json" jsonb;--> statement-breakpoint
CREATE INDEX "sessions_project_created_id_idx" ON "sessions" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX "workspace_sessions_session_idx" ON "workspace_sessions" USING btree ("session_id");