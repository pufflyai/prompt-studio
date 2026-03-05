ALTER TABLE "ticket_statuses" ADD COLUMN "deleted_at" text;
--> statement-breakpoint
ALTER TABLE "ticket_tags" ADD COLUMN "deleted_at" text;
