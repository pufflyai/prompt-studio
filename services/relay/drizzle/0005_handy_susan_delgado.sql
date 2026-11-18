CREATE TABLE "relay_payload_maintenance" (
	"key" text PRIMARY KEY NOT NULL,
	"completedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relay_project_retirements" (
	"projectKey" text PRIMARY KEY NOT NULL,
	"operationId" text NOT NULL,
	"completedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "relay_sync_object_deletions" ADD COLUMN "projectKey" text;--> statement-breakpoint
ALTER TABLE "relay_sync_object_deletions" ADD COLUMN "multipartId" text;--> statement-breakpoint
ALTER TABLE "relay_asset_uploads" ADD COLUMN "legacyObjectKey" text;--> statement-breakpoint
CREATE INDEX "relay_sync_object_deletions_project" ON "relay_sync_object_deletions" USING btree ("projectKey","objectKey");--> statement-breakpoint
CREATE INDEX "relay_asset_uploads_object_key" ON "relay_asset_uploads" USING btree ("objectKey");