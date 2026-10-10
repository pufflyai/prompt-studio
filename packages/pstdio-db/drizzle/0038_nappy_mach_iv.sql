ALTER TABLE "session_queue_entries" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "session_queue_entries" ADD COLUMN "steering_delivery_json" jsonb;--> statement-breakpoint
ALTER TABLE "session_queue_entries" ADD COLUMN "revision" text DEFAULT '' NOT NULL;