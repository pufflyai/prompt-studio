ALTER TYPE "public"."session_status" ADD VALUE 'queued' BEFORE 'completed';--> statement-breakpoint
CREATE TABLE "session_queue_entries" (
	"session_id" text PRIMARY KEY NOT NULL,
	"queue_position" integer GENERATED ALWAYS AS IDENTITY (sequence name "session_queue_entries_queue_position_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"prompt" text NOT NULL,
	"request_kind" text DEFAULT 'start' NOT NULL,
	"question_response_json" jsonb,
	"dispatch_started_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"max_concurrent_sessions" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_queue_entries" ADD CONSTRAINT "session_queue_entries_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;