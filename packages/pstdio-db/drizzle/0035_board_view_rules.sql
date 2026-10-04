ALTER TABLE "board_views" RENAME COLUMN "filters" TO "filter";--> statement-breakpoint
ALTER TABLE "board_default_views" DROP CONSTRAINT "board_default_views_project_id_extension_instance_id_board_id_pk";--> statement-breakpoint
ALTER TABLE "board_default_views" ALTER COLUMN "extension_instance_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "board_views" ALTER COLUMN "extension_instance_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "board_views" ADD COLUMN "sorts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "board_default_views" ADD CONSTRAINT "board_default_views_scope_unique" UNIQUE NULLS NOT DISTINCT("project_id","extension_instance_id","board_id");