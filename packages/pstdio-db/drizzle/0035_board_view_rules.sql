ALTER TABLE "board_views" RENAME COLUMN "filters" TO "filter";--> statement-breakpoint
ALTER TABLE "board_views" ADD COLUMN "sorts" jsonb DEFAULT '[]'::jsonb NOT NULL;