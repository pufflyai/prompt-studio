CREATE TABLE "ticket_tag_options" (
	"id" text PRIMARY KEY NOT NULL,
	"tag_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text,
	"description" text,
	"sort_order" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" DROP CONSTRAINT "ticket_tag_assignments_ticket_tag_id_ticket_tags_id_fk";
--> statement-breakpoint
DROP INDEX "ticket_tag_assignments_ticket_tag_idx";--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" ADD COLUMN "ticket_tag_option_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_tags" ADD COLUMN "type" text DEFAULT 'single_select' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_tag_options" ADD CONSTRAINT "ticket_tag_options_tag_id_ticket_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."ticket_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_tag_options_tag_name_idx" ON "ticket_tag_options" USING btree ("tag_id","name");--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" ADD CONSTRAINT "ticket_tag_assignments_ticket_tag_option_id_ticket_tag_options_id_fk" FOREIGN KEY ("ticket_tag_option_id") REFERENCES "public"."ticket_tag_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_tag_assignments_ticket_option_idx" ON "ticket_tag_assignments" USING btree ("ticket_id","ticket_tag_option_id");--> statement-breakpoint
ALTER TABLE "ticket_statuses" DROP COLUMN "is_open";--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" DROP COLUMN "ticket_tag_id";--> statement-breakpoint
ALTER TABLE "ticket_tags" DROP COLUMN "color";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "priority";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "complexity";--> statement-breakpoint
DROP TYPE "public"."ticket_complexity";