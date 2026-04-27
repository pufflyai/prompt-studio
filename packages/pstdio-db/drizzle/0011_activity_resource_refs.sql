DROP INDEX IF EXISTS "activity_events_resource_created_id_idx";
--> statement-breakpoint
ALTER TABLE "activity_events" ALTER COLUMN "resource_type" TYPE text USING "resource_type"::text;
--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "target_ref_json" jsonb;
--> statement-breakpoint
UPDATE "activity_events"
SET "target_ref_json" = jsonb_build_object(
  'type', "resource_type",
  'id', "resource_id",
  'projectId', "project_id"
);
--> statement-breakpoint
ALTER TABLE "activity_events" ALTER COLUMN "target_ref_json" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "related_refs_json" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "source_extension_id" text;
--> statement-breakpoint
DROP TYPE IF EXISTS "activity_resource_type";
--> statement-breakpoint
CREATE INDEX "activity_events_resource_created_id_idx" ON "activity_events" USING btree ("project_id","resource_type","resource_id","created_at","id");
