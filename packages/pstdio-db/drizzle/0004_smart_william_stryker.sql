CREATE TABLE "storage_ordered_operations" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"local_sequence" bigserial NOT NULL,
	"request_fingerprint" text,
	"envelope" "bytea",
	"admission_epoch" text,
	"admission" "bytea",
	"admission_fingerprint" text,
	"delivered" boolean DEFAULT false NOT NULL,
	"settled_epoch" text,
	CONSTRAINT "storage_ordered_operations_workbench_id_extension_id_operation_id_pk" PRIMARY KEY("workbench_id","extension_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "storage_ordered_owners" (
	"workbench_id" text NOT NULL,
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
	CONSTRAINT "storage_ordered_owners_workbench_id_extension_id_pk" PRIMARY KEY("workbench_id","extension_id")
);
--> statement-breakpoint
CREATE TABLE "storage_ordered_receipts" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"epoch" text NOT NULL,
	"operation_id" text NOT NULL,
	"admission_fingerprint" text NOT NULL,
	"state" text NOT NULL,
	"indexed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "storage_ordered_receipts_workbench_id_extension_id_epoch_operation_id_pk" PRIMARY KEY("workbench_id","extension_id","epoch","operation_id")
);
--> statement-breakpoint
CREATE TABLE "storage_ordered_records" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"record_id" text NOT NULL,
	"state" "bytea" NOT NULL,
	CONSTRAINT "storage_ordered_records_workbench_id_extension_id_record_id_pk" PRIMARY KEY("workbench_id","extension_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "storage_ordered_touches" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"record_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"local_sequence" bigint NOT NULL,
	CONSTRAINT "storage_ordered_touches_workbench_id_extension_id_record_id_operation_id_pk" PRIMARY KEY("workbench_id","extension_id","record_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "storage_log_entries" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"log_name" text NOT NULL,
	"scope" text NOT NULL,
	"stream" text NOT NULL,
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
	CONSTRAINT "storage_log_entries_pk" PRIMARY KEY("workbench_id","extension_id","log_name","scope","stream","entry_id")
);
--> statement-breakpoint
CREATE TABLE "storage_log_streams" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"log_name" text NOT NULL,
	"scope" text NOT NULL,
	"stream" text NOT NULL,
	"head" bigint DEFAULT 0 NOT NULL,
	"complete_through" bigint DEFAULT 0 NOT NULL,
	"state_id" text,
	"through" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "storage_log_streams_pk" PRIMARY KEY("workbench_id","extension_id","log_name","scope","stream")
);
--> statement-breakpoint
CREATE TABLE "storage_personal_history" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"device_id" text NOT NULL,
	"kind" text NOT NULL,
	"record_id" text NOT NULL,
	"value" jsonb,
	"seed_id" text,
	"pending_id" text,
	CONSTRAINT "storage_personal_history_pk" PRIMARY KEY("workbench_id","extension_id","kind","device_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "storage_personal_history_positions" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"cursor" text,
	"migrated" boolean DEFAULT false NOT NULL,
	CONSTRAINT "storage_personal_history_positions_pk" PRIMARY KEY("workbench_id","extension_id")
);
--> statement-breakpoint
CREATE TABLE "storage_personal_history_sources" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"source_id" text NOT NULL,
	"kind" text NOT NULL,
	"device_id" text NOT NULL,
	"record_id" text NOT NULL,
	"value" jsonb,
	"seed_id" text,
	"entry_id" text NOT NULL,
	"sequence" bigint NOT NULL,
	"entry_index" integer NOT NULL,
	CONSTRAINT "storage_personal_history_sources_pk" PRIMARY KEY("workbench_id","extension_id","source_id","kind","device_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "storage_ordered_resource_numbers" (
	"workbench_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"prefix" text NOT NULL,
	"high_water" bigint NOT NULL,
	"extension_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" bigint,
	"current" boolean DEFAULT false NOT NULL,
	CONSTRAINT "storage_ordered_numbers_pk" PRIMARY KEY("workbench_id","resource_id","prefix")
);
--> statement-breakpoint
ALTER TABLE "storage_ordered_operations" ADD CONSTRAINT "storage_ordered_operations_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_ordered_owners"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" ADD CONSTRAINT "storage_ordered_owners_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" ADD CONSTRAINT "storage_ordered_receipts_workbench_id_extension_id_operation_id_storage_ordered_operations_workbench_id_extension_id_operation_id_fk" FOREIGN KEY ("workbench_id","extension_id","operation_id") REFERENCES "public"."storage_ordered_operations"("workbench_id","extension_id","operation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_records" ADD CONSTRAINT "storage_ordered_records_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_ordered_owners"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" ADD CONSTRAINT "storage_ordered_touches_workbench_id_extension_id_operation_id_storage_ordered_operations_workbench_id_extension_id_operation_id_fk" FOREIGN KEY ("workbench_id","extension_id","operation_id") REFERENCES "public"."storage_ordered_operations"("workbench_id","extension_id","operation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_log_entries" ADD CONSTRAINT "storage_log_entries_stream_fk" FOREIGN KEY ("workbench_id","extension_id","log_name","scope","stream") REFERENCES "public"."storage_log_streams"("workbench_id","extension_id","log_name","scope","stream") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_log_streams" ADD CONSTRAINT "storage_log_streams_project_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_personal_history" ADD CONSTRAINT "storage_personal_history_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_personal_history_positions" ADD CONSTRAINT "storage_personal_history_positions_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_personal_history_sources" ADD CONSTRAINT "storage_personal_history_sources_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_resource_numbers" ADD CONSTRAINT "storage_ordered_resource_numbers_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_ordered_operations_pending_idx" ON "storage_ordered_operations" USING btree ("workbench_id","extension_id","local_sequence") WHERE "storage_ordered_operations"."envelope" IS NOT NULL AND "storage_ordered_operations"."settled_epoch" IS NULL;--> statement-breakpoint
CREATE INDEX "storage_ordered_receipts_unindexed_idx" ON "storage_ordered_receipts" USING btree ("workbench_id","extension_id","epoch","operation_id") WHERE "storage_ordered_receipts"."indexed" = false;--> statement-breakpoint
CREATE INDEX "storage_ordered_touches_operation_idx" ON "storage_ordered_touches" USING btree ("workbench_id","extension_id","operation_id");--> statement-breakpoint
CREATE INDEX "storage_ordered_touches_record_sequence_idx" ON "storage_ordered_touches" USING btree ("workbench_id","extension_id","record_id","local_sequence");--> statement-breakpoint
CREATE INDEX "storage_log_entries_relay_idx" ON "storage_log_entries" USING btree ("workbench_id","extension_id","log_name","scope","stream","relay_sequence","relay_index");--> statement-breakpoint
CREATE INDEX "storage_log_entries_pending_idx" ON "storage_log_entries" USING btree ("workbench_id","extension_id","log_name","scope","stream","local_sequence") WHERE "storage_log_entries"."local" = true AND "storage_log_entries"."relay_sequence" IS NULL;--> statement-breakpoint
CREATE INDEX "storage_log_entries_retention_idx" ON "storage_log_entries" USING btree ("workbench_id","extension_id","log_name","scope","stream","created_at");--> statement-breakpoint
CREATE INDEX "storage_ordered_numbers_floor" ON "storage_ordered_resource_numbers" USING btree ("workbench_id","prefix","high_water");--> statement-breakpoint
CREATE INDEX "storage_ordered_numbers_claim" ON "storage_ordered_resource_numbers" USING btree ("workbench_id","extension_id","kind","prefix","value","resource_id") WHERE "storage_ordered_resource_numbers"."current" = true;