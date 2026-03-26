CREATE TABLE "workspace_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"session_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD CONSTRAINT "workspace_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD CONSTRAINT "workspace_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_sessions_ws_session_idx" ON "workspace_sessions" USING btree ("workspace_id","session_id");--> statement-breakpoint
INSERT INTO "workspace_sessions" ("id", "workspace_id", "session_id", "created_at")
SELECT gen_random_uuid()::text, "id", "session_id", "updated_at"
FROM "workspaces"
WHERE "session_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" DROP COLUMN "session_id";