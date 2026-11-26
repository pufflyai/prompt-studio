ALTER TABLE "extension_resource_sequences" ALTER COLUMN "next_value" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "storage_resource_aliases" ADD COLUMN "prefix" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_resource_aliases" ADD COLUMN "value" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_resource_identities" ADD COLUMN "prefix" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_resource_identities" ADD COLUMN "value" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "storage_resource_alias_high_water" ON "storage_resource_aliases" USING btree ("workbench_id","prefix","value");--> statement-breakpoint
CREATE INDEX "storage_resource_identity_high_water" ON "storage_resource_identities" USING btree ("workbench_id","prefix","value");