ALTER TABLE "session_queue_entries" ADD COLUMN "params_json" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "params_json" jsonb;