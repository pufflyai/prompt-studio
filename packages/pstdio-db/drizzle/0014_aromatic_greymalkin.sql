ALTER TABLE "session_queue_entries" DROP CONSTRAINT "session_queue_entries_pkey";--> statement-breakpoint
ALTER TABLE "session_queue_entries" ADD PRIMARY KEY ("queue_position");--> statement-breakpoint
CREATE INDEX "session_queue_entries_session_id_idx" ON "session_queue_entries" USING btree ("session_id");
