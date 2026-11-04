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
ALTER TABLE "storage_ordered_operations" ADD CONSTRAINT "storage_ordered_operations_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_ordered_owners"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" ADD CONSTRAINT "storage_ordered_owners_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_receipts" ADD CONSTRAINT "storage_ordered_receipts_workbench_id_extension_id_operation_id_storage_ordered_operations_workbench_id_extension_id_operation_id_fk" FOREIGN KEY ("workbench_id","extension_id","operation_id") REFERENCES "public"."storage_ordered_operations"("workbench_id","extension_id","operation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_records" ADD CONSTRAINT "storage_ordered_records_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_ordered_owners"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_ordered_touches" ADD CONSTRAINT "storage_ordered_touches_workbench_id_extension_id_operation_id_storage_ordered_operations_workbench_id_extension_id_operation_id_fk" FOREIGN KEY ("workbench_id","extension_id","operation_id") REFERENCES "public"."storage_ordered_operations"("workbench_id","extension_id","operation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_ordered_operations_pending_idx" ON "storage_ordered_operations" USING btree ("workbench_id","extension_id","local_sequence") WHERE "storage_ordered_operations"."envelope" IS NOT NULL AND "storage_ordered_operations"."settled_epoch" IS NULL;--> statement-breakpoint
CREATE INDEX "storage_ordered_touches_operation_idx" ON "storage_ordered_touches" USING btree ("workbench_id","extension_id","operation_id");--> statement-breakpoint
CREATE INDEX "storage_ordered_touches_record_sequence_idx" ON "storage_ordered_touches" USING btree ("workbench_id","extension_id","record_id","local_sequence");