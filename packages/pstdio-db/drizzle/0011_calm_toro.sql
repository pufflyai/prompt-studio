CREATE TABLE "owners" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "owners_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"epoch" text,
	"joined" boolean DEFAULT false NOT NULL,
	"after" bigint DEFAULT 0 NOT NULL,
	"state_id" text,
	"through" bigint DEFAULT 0 NOT NULL,
	"pending_bytes" bigint DEFAULT 0 NOT NULL,
	"state_bytes" bigint DEFAULT 0 NOT NULL,
	"skipped" boolean DEFAULT false NOT NULL,
	"receipt_root" "bytea",
	"revision" bigint DEFAULT 0 NOT NULL,
	"live_count" bigint DEFAULT 0 NOT NULL,
	"record_indexes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"history_cursor" text,
	"history_migrated" boolean DEFAULT false NOT NULL,
	CONSTRAINT "owners_project_extension_unique" UNIQUE("project_id","extension_id")
);
--> statement-breakpoint
CREATE TABLE "resource_links" (
	"source_owner" integer NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" text NOT NULL,
	"target_owner" integer NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"role" text DEFAULT 'context' NOT NULL,
	"details" jsonb NOT NULL,
	CONSTRAINT "resource_links_source_owner_source_kind_source_id_target_owner_target_kind_target_id_pk" PRIMARY KEY("source_owner","source_kind","source_id","target_owner","target_kind","target_id")
);
--> statement-breakpoint
CREATE TABLE "resource_prefixes" (
	"project_id" text NOT NULL,
	"prefix" text NOT NULL,
	"extension_id" text NOT NULL,
	"kind" text NOT NULL,
	"next_value" bigint NOT NULL,
	CONSTRAINT "resource_prefixes_project_id_prefix_pk" PRIMARY KEY("project_id","prefix"),
	CONSTRAINT "resource_prefixes_project_extension_kind_unique" UNIQUE("project_id","extension_id","kind")
);
--> statement-breakpoint
CREATE TABLE "log_entries" (
	"stream_id" bigint NOT NULL,
	"entry_id" text NOT NULL,
	"writer_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	"fingerprint" text NOT NULL,
	"entry" "bytea" NOT NULL,
	"local_sequence" bigserial NOT NULL,
	"local" boolean DEFAULT false NOT NULL,
	"relay_sequence" bigint,
	"relay_index" integer,
	"envelope" "bytea",
	CONSTRAINT "log_entries_pk" PRIMARY KEY("stream_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "log_streams" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "log_streams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" integer NOT NULL,
	"log_name" text NOT NULL,
	"scope" text NOT NULL,
	"stream" text NOT NULL,
	"head" bigint DEFAULT 0 NOT NULL,
	"complete_through" bigint DEFAULT 0 NOT NULL,
	"state_id" text,
	"through" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "log_streams_owner_address_unique" UNIQUE("owner_id","log_name","scope","stream")
);
--> statement-breakpoint
CREATE TABLE "history_rows" (
	"owner_id" integer NOT NULL,
	"device_id" text NOT NULL,
	"kind" text NOT NULL,
	"record_id" text NOT NULL,
	"value" jsonb,
	"seed_id" text,
	"pending_id" text,
	CONSTRAINT "history_rows_pk" PRIMARY KEY("owner_id","kind","device_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "history_sources" (
	"owner_id" integer NOT NULL,
	"source_id" text NOT NULL,
	"kind" text NOT NULL,
	"device_id" text NOT NULL,
	"record_id" text NOT NULL,
	"value" jsonb,
	"seed_id" text,
	"entry_id" text NOT NULL,
	"sequence" bigint NOT NULL,
	"entry_index" integer NOT NULL,
	CONSTRAINT "history_sources_pk" PRIMARY KEY("owner_id","source_id","kind","device_id","record_id")
);
--> statement-breakpoint
ALTER TABLE "extension_resource_sequences" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resource_anchors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_log_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_log_streams" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_personal_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_personal_history_positions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_personal_history_sources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_record_outbox" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_record_sync" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_record_indexes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_record_projections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" DROP CONSTRAINT "storage_ordered_operations_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_ordered_records" DROP CONSTRAINT "storage_ordered_records_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_current_records" DROP CONSTRAINT "storage_current_records_workbench_id_extension_id_storage_record_projections_workbench_id_extension_id_fk";
--> statement-breakpoint
DROP TABLE "extension_resource_sequences" CASCADE;--> statement-breakpoint
DROP TABLE "resource_anchors" CASCADE;--> statement-breakpoint
DROP TABLE "storage_log_entries" CASCADE;--> statement-breakpoint
DROP TABLE "storage_log_streams" CASCADE;--> statement-breakpoint
DROP TABLE "storage_personal_history" CASCADE;--> statement-breakpoint
DROP TABLE "storage_personal_history_positions" CASCADE;--> statement-breakpoint
DROP TABLE "storage_personal_history_sources" CASCADE;--> statement-breakpoint
DROP TABLE "storage_record_indexes" CASCADE;--> statement-breakpoint
DROP TABLE "storage_record_projections" CASCADE;--> statement-breakpoint
ALTER TABLE "recovery_point_owners" RENAME COLUMN "workbench_id" TO "project_id";--> statement-breakpoint
ALTER TABLE "recovery_points" RENAME COLUMN "workbench_id" TO "project_id";--> statement-breakpoint
ALTER TABLE "asset_transfers" DROP CONSTRAINT "asset_transfers_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "native_document_file_projections" DROP CONSTRAINT "native_document_file_projections_workbench_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "native_document_rooms" DROP CONSTRAINT "native_document_rooms_workbench_id_extension_id_document_key_native_document_sources_workbench_id_extension_id_document_key_fk";
--> statement-breakpoint
ALTER TABLE "native_document_sources" DROP CONSTRAINT "native_document_sources_workbench_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "recovery_point_owners" DROP CONSTRAINT "recovery_point_owners_workbench_id_hours_recovery_points_workbench_id_hours_fk";
--> statement-breakpoint
ALTER TABLE "recovery_points" DROP CONSTRAINT "recovery_points_workbench_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_document_operations" DROP CONSTRAINT "storage_document_operations_document_fk";
--> statement-breakpoint
ALTER TABLE "storage_document_updates" DROP CONSTRAINT "storage_document_updates_document_fk";
--> statement-breakpoint
ALTER TABLE "storage_documents" DROP CONSTRAINT "storage_documents_workbench_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" DROP CONSTRAINT "storage_ordered_receipts_workbench_id_extension_id_operation_id_storage_ordered_operations_workbench_id_extension_id_operation_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" DROP CONSTRAINT "storage_ordered_touches_workbench_id_extension_id_operation_id_storage_ordered_operations_workbench_id_extension_id_operation_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_current_records" DROP CONSTRAINT "storage_current_records_workbench_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_resource_projections" DROP CONSTRAINT "storage_resource_projections_workbench_id_extension_id_document_id_storage_documents_workbench_id_extension_id_document_id_fk";
--> statement-breakpoint
DROP INDEX "storage_current_records_lifetime_upgrade_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_operations_pending_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_receipts_operation_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_receipts_unindexed_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_touches_operation_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_touches_record_sequence_idx";--> statement-breakpoint
ALTER TABLE "asset_transfers" DROP CONSTRAINT "asset_transfers_project_id_extension_id_operation_id_pk";--> statement-breakpoint
ALTER TABLE "native_document_sources" DROP CONSTRAINT "native_document_sources_workbench_id_extension_id_document_key_pk";--> statement-breakpoint
ALTER TABLE "recovery_point_owners" DROP CONSTRAINT "recovery_point_owners_workbench_id_hours_extension_id_pk";--> statement-breakpoint
ALTER TABLE "recovery_points" DROP CONSTRAINT "recovery_points_workbench_id_hours_pk";--> statement-breakpoint
ALTER TABLE "storage_documents" DROP CONSTRAINT "storage_documents_workbench_id_extension_id_document_id_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" DROP CONSTRAINT "storage_ordered_operations_workbench_id_extension_id_operation_id_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" DROP CONSTRAINT "storage_ordered_receipts_workbench_id_extension_id_epoch_operation_id_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_records" DROP CONSTRAINT "storage_ordered_records_workbench_id_extension_id_record_id_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" DROP CONSTRAINT "storage_ordered_touches_workbench_id_extension_id_record_id_operation_id_pk";--> statement-breakpoint
ALTER TABLE "storage_current_records" DROP CONSTRAINT "storage_current_records_workbench_id_extension_id_record_id_pk";--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_owner_id_operation_id_pk" PRIMARY KEY("owner_id","operation_id");--> statement-breakpoint
ALTER TABLE "native_document_sources" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "native_document_sources" ADD CONSTRAINT "native_document_sources_owner_id_document_key_pk" PRIMARY KEY("owner_id","document_key");--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD CONSTRAINT "recovery_point_owners_project_id_hours_owner_id_pk" PRIMARY KEY("project_id","hours","owner_id");--> statement-breakpoint
ALTER TABLE "recovery_points" ADD CONSTRAINT "recovery_points_project_id_hours_pk" PRIMARY KEY("project_id","hours");--> statement-breakpoint
ALTER TABLE "storage_documents" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_documents" ADD CONSTRAINT "storage_documents_owner_id_document_id_pk" PRIMARY KEY("owner_id","document_id");--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" ADD CONSTRAINT "storage_ordered_operations_owner_id_operation_id_pk" PRIMARY KEY("owner_id","operation_id");--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" ADD CONSTRAINT "storage_ordered_receipts_owner_id_epoch_operation_id_pk" PRIMARY KEY("owner_id","epoch","operation_id");--> statement-breakpoint
ALTER TABLE "storage_ordered_records" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_records" ADD CONSTRAINT "storage_ordered_records_owner_id_record_id_pk" PRIMARY KEY("owner_id","record_id");--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" ADD CONSTRAINT "storage_ordered_touches_owner_id_record_id_operation_id_pk" PRIMARY KEY("owner_id","record_id","operation_id");--> statement-breakpoint
ALTER TABLE "storage_current_records" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_current_records" ADD CONSTRAINT "storage_current_records_owner_id_record_id_pk" PRIMARY KEY("owner_id","record_id");--> statement-breakpoint
ALTER TABLE "native_document_file_projections" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "native_document_rooms" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_document_operations" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_document_updates" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_resource_projections" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_links" ADD CONSTRAINT "resource_links_source_owner_owners_id_fk" FOREIGN KEY ("source_owner") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_links" ADD CONSTRAINT "resource_links_target_owner_owners_id_fk" FOREIGN KEY ("target_owner") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_prefixes" ADD CONSTRAINT "resource_prefixes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_stream_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."log_streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_streams" ADD CONSTRAINT "log_streams_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_rows" ADD CONSTRAINT "history_rows_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_sources" ADD CONSTRAINT "history_sources_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_links_target_idx" ON "resource_links" USING btree ("target_owner","target_kind","target_id","source_owner","source_kind","source_id");--> statement-breakpoint
CREATE INDEX "log_entries_relay_idx" ON "log_entries" USING btree ("stream_id","relay_sequence","relay_index");--> statement-breakpoint
CREATE INDEX "log_entries_pending_idx" ON "log_entries" USING btree ("stream_id","local_sequence") WHERE "log_entries"."local" = true AND "log_entries"."relay_sequence" IS NULL;--> statement-breakpoint
CREATE INDEX "log_entries_retention_idx" ON "log_entries" USING btree ("stream_id","created_at");--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_document_file_projections" ADD CONSTRAINT "native_document_file_projections_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_document_rooms" ADD CONSTRAINT "native_document_rooms_owner_id_document_key_native_document_sources_owner_id_document_key_fk" FOREIGN KEY ("owner_id","document_key") REFERENCES "public"."native_document_sources"("owner_id","document_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_document_sources" ADD CONSTRAINT "native_document_sources_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD CONSTRAINT "recovery_point_owners_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD CONSTRAINT "recovery_point_owners_project_id_hours_recovery_points_project_id_hours_fk" FOREIGN KEY ("project_id","hours") REFERENCES "public"."recovery_points"("project_id","hours") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_points" ADD CONSTRAINT "recovery_points_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_document_operations" ADD CONSTRAINT "storage_document_operations_document_fk" FOREIGN KEY ("owner_id","document_id") REFERENCES "public"."storage_documents"("owner_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_document_updates" ADD CONSTRAINT "storage_document_updates_document_fk" FOREIGN KEY ("owner_id","document_id") REFERENCES "public"."storage_documents"("owner_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_documents" ADD CONSTRAINT "storage_documents_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" ADD CONSTRAINT "storage_ordered_operations_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" ADD CONSTRAINT "storage_ordered_receipts_owner_id_operation_id_storage_ordered_operations_owner_id_operation_id_fk" FOREIGN KEY ("owner_id","operation_id") REFERENCES "public"."storage_ordered_operations"("owner_id","operation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_records" ADD CONSTRAINT "storage_ordered_records_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" ADD CONSTRAINT "storage_ordered_touches_owner_id_operation_id_storage_ordered_operations_owner_id_operation_id_fk" FOREIGN KEY ("owner_id","operation_id") REFERENCES "public"."storage_ordered_operations"("owner_id","operation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_current_records" ADD CONSTRAINT "storage_current_records_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_projections" ADD CONSTRAINT "storage_resource_projections_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_projections" ADD CONSTRAINT "storage_resource_projections_owner_id_document_id_storage_documents_owner_id_document_id_fk" FOREIGN KEY ("owner_id","document_id") REFERENCES "public"."storage_documents"("owner_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "native_rooms_source" ON "native_document_rooms" USING btree ("owner_id","document_key");--> statement-breakpoint
CREATE INDEX "recovery_owner_revision" ON "recovery_point_owners" USING btree ("owner_id","revision");--> statement-breakpoint
CREATE INDEX "storage_resource_projection_document" ON "storage_resource_projections" USING btree ("owner_id","document_id");--> statement-breakpoint
CREATE INDEX "storage_ordered_operations_pending_idx" ON "storage_ordered_operations" USING btree ("owner_id","local_sequence") WHERE "storage_ordered_operations"."envelope" IS NOT NULL AND "storage_ordered_operations"."settled_epoch" IS NULL;--> statement-breakpoint
CREATE INDEX "storage_ordered_receipts_operation_idx" ON "storage_ordered_receipts" USING btree ("owner_id","operation_id");--> statement-breakpoint
CREATE INDEX "storage_ordered_receipts_unindexed_idx" ON "storage_ordered_receipts" USING btree ("owner_id","epoch","operation_id") WHERE "storage_ordered_receipts"."indexed" = false;--> statement-breakpoint
CREATE INDEX "storage_ordered_touches_operation_idx" ON "storage_ordered_touches" USING btree ("owner_id","operation_id");--> statement-breakpoint
CREATE INDEX "storage_ordered_touches_record_sequence_idx" ON "storage_ordered_touches" USING btree ("owner_id","record_id","local_sequence");--> statement-breakpoint
ALTER TABLE "asset_transfers" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "asset_transfers" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "native_document_file_projections" DROP CONSTRAINT "native_document_file_projections_pk";
--> statement-breakpoint
ALTER TABLE "native_document_file_projections" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "native_document_file_projections" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "native_document_rooms" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "native_document_rooms" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "native_document_sources" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "native_document_sources" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "recovery_point_owners" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_document_operations" DROP CONSTRAINT "storage_document_operations_pk";
--> statement-breakpoint
ALTER TABLE "storage_document_operations" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_document_operations" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_document_updates" DROP CONSTRAINT "storage_document_updates_pk";
--> statement-breakpoint
ALTER TABLE "storage_document_updates" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_document_updates" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_documents" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_documents" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_records" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_records" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_current_records" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_current_records" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_resource_projections" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "native_document_file_projections" ADD CONSTRAINT "native_document_file_projections_pk" PRIMARY KEY("owner_id","document_key","projection_key");--> statement-breakpoint
ALTER TABLE "storage_document_operations" ADD CONSTRAINT "storage_document_operations_pk" PRIMARY KEY("owner_id","document_id","operation_id");--> statement-breakpoint
ALTER TABLE "storage_document_updates" ADD CONSTRAINT "storage_document_updates_pk" PRIMARY KEY("owner_id","document_id","revision");