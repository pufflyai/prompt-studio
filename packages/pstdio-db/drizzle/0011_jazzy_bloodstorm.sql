CREATE TABLE "owners" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "owners_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"history_cursor" text,
	"history_migrated" boolean DEFAULT false NOT NULL,
	CONSTRAINT "owners_project_extension_unique" UNIQUE("project_id","extension_id")
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
ALTER TABLE "storage_log_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_log_streams" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_personal_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_personal_history_positions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storage_personal_history_sources" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "storage_log_entries" CASCADE;--> statement-breakpoint
DROP TABLE "storage_log_streams" CASCADE;--> statement-breakpoint
DROP TABLE "storage_personal_history" CASCADE;--> statement-breakpoint
DROP TABLE "storage_personal_history_positions" CASCADE;--> statement-breakpoint
DROP TABLE "storage_personal_history_sources" CASCADE;--> statement-breakpoint
ALTER TABLE "recovery_point_owners" RENAME COLUMN "workbench_id" TO "project_id";--> statement-breakpoint
ALTER TABLE "recovery_points" RENAME COLUMN "workbench_id" TO "project_id";--> statement-breakpoint
ALTER TABLE "asset_transfers" DROP CONSTRAINT "asset_transfers_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "recovery_point_owners" DROP CONSTRAINT "recovery_point_owners_workbench_id_hours_recovery_points_workbench_id_hours_fk";
--> statement-breakpoint
ALTER TABLE "recovery_points" DROP CONSTRAINT "recovery_points_workbench_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" DROP CONSTRAINT "storage_ordered_operations_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" DROP CONSTRAINT "storage_ordered_owners_workbench_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" DROP CONSTRAINT "storage_ordered_receipts_workbench_id_extension_id_operation_id_storage_ordered_operations_workbench_id_extension_id_operation_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_ordered_records" DROP CONSTRAINT "storage_ordered_records_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" DROP CONSTRAINT "storage_ordered_touches_workbench_id_extension_id_operation_id_storage_ordered_operations_workbench_id_extension_id_operation_id_fk";
--> statement-breakpoint
DROP INDEX "storage_ordered_operations_pending_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_receipts_operation_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_receipts_unindexed_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_touches_operation_idx";--> statement-breakpoint
DROP INDEX "storage_ordered_touches_record_sequence_idx";--> statement-breakpoint
ALTER TABLE "asset_transfers" DROP CONSTRAINT "asset_transfers_project_id_extension_id_operation_id_pk";--> statement-breakpoint
ALTER TABLE "recovery_point_owners" DROP CONSTRAINT "recovery_point_owners_workbench_id_hours_extension_id_pk";--> statement-breakpoint
ALTER TABLE "recovery_points" DROP CONSTRAINT "recovery_points_workbench_id_hours_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" DROP CONSTRAINT "storage_ordered_operations_workbench_id_extension_id_operation_id_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" DROP CONSTRAINT "storage_ordered_owners_workbench_id_extension_id_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" DROP CONSTRAINT "storage_ordered_receipts_workbench_id_extension_id_epoch_operation_id_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_records" DROP CONSTRAINT "storage_ordered_records_workbench_id_extension_id_record_id_pk";--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" DROP CONSTRAINT "storage_ordered_touches_workbench_id_extension_id_record_id_operation_id_pk";--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_owner_id_operation_id_pk" PRIMARY KEY("owner_id","operation_id");--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD CONSTRAINT "recovery_point_owners_project_id_hours_owner_id_pk" PRIMARY KEY("project_id","hours","owner_id");--> statement-breakpoint
ALTER TABLE "recovery_points" ADD CONSTRAINT "recovery_points_project_id_hours_pk" PRIMARY KEY("project_id","hours");--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" ADD CONSTRAINT "storage_ordered_operations_owner_id_operation_id_pk" PRIMARY KEY("owner_id","operation_id");--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" ADD CONSTRAINT "storage_ordered_owners_owner_id_pk" PRIMARY KEY("owner_id");--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" ADD CONSTRAINT "storage_ordered_receipts_owner_id_epoch_operation_id_pk" PRIMARY KEY("owner_id","epoch","operation_id");--> statement-breakpoint
ALTER TABLE "storage_ordered_records" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_records" ADD CONSTRAINT "storage_ordered_records_owner_id_record_id_pk" PRIMARY KEY("owner_id","record_id");--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" ADD COLUMN "owner_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" ADD CONSTRAINT "storage_ordered_touches_owner_id_record_id_operation_id_pk" PRIMARY KEY("owner_id","record_id","operation_id");--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_stream_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."log_streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_streams" ADD CONSTRAINT "log_streams_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_rows" ADD CONSTRAINT "history_rows_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_sources" ADD CONSTRAINT "history_sources_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_entries_relay_idx" ON "log_entries" USING btree ("stream_id","relay_sequence","relay_index");--> statement-breakpoint
CREATE INDEX "log_entries_pending_idx" ON "log_entries" USING btree ("stream_id","local_sequence") WHERE "log_entries"."local" = true AND "log_entries"."relay_sequence" IS NULL;--> statement-breakpoint
CREATE INDEX "log_entries_retention_idx" ON "log_entries" USING btree ("stream_id","created_at");--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD CONSTRAINT "recovery_point_owners_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_point_owners" ADD CONSTRAINT "recovery_point_owners_project_id_hours_recovery_points_project_id_hours_fk" FOREIGN KEY ("project_id","hours") REFERENCES "public"."recovery_points"("project_id","hours") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_points" ADD CONSTRAINT "recovery_points_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" ADD CONSTRAINT "storage_ordered_operations_owner_id_storage_ordered_owners_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."storage_ordered_owners"("owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" ADD CONSTRAINT "storage_ordered_owners_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" ADD CONSTRAINT "storage_ordered_receipts_owner_id_operation_id_storage_ordered_operations_owner_id_operation_id_fk" FOREIGN KEY ("owner_id","operation_id") REFERENCES "public"."storage_ordered_operations"("owner_id","operation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_records" ADD CONSTRAINT "storage_ordered_records_owner_id_storage_ordered_owners_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."storage_ordered_owners"("owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" ADD CONSTRAINT "storage_ordered_touches_owner_id_operation_id_storage_ordered_operations_owner_id_operation_id_fk" FOREIGN KEY ("owner_id","operation_id") REFERENCES "public"."storage_ordered_operations"("owner_id","operation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recovery_owner_revision" ON "recovery_point_owners" USING btree ("owner_id","revision");--> statement-breakpoint
CREATE INDEX "storage_ordered_operations_pending_idx" ON "storage_ordered_operations" USING btree ("owner_id","local_sequence") WHERE "storage_ordered_operations"."envelope" IS NOT NULL AND "storage_ordered_operations"."settled_epoch" IS NULL;--> statement-breakpoint
CREATE INDEX "storage_ordered_receipts_operation_idx" ON "storage_ordered_receipts" USING btree ("owner_id","operation_id");--> statement-breakpoint
CREATE INDEX "storage_ordered_receipts_unindexed_idx" ON "storage_ordered_receipts" USING btree ("owner_id","epoch","operation_id") WHERE "storage_ordered_receipts"."indexed" = false;--> statement-breakpoint
CREATE INDEX "storage_ordered_touches_operation_idx" ON "storage_ordered_touches" USING btree ("owner_id","operation_id");--> statement-breakpoint
CREATE INDEX "storage_ordered_touches_record_sequence_idx" ON "storage_ordered_touches" USING btree ("owner_id","record_id","local_sequence");--> statement-breakpoint
ALTER TABLE "asset_transfers" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "asset_transfers" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "recovery_point_owners" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_records" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_records" DROP COLUMN "extension_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" DROP COLUMN "workbench_id";--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" DROP COLUMN "extension_id";