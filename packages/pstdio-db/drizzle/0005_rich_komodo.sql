ALTER TABLE "sessions" ADD COLUMN "original_session_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cwd" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "setup_error" text;