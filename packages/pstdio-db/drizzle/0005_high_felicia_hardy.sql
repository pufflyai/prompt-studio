CREATE TABLE "storage_ordered_replaced" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"record_id" text NOT NULL,
	"paths" text[] NOT NULL,
	"whole" boolean NOT NULL,
	"deleted" boolean NOT NULL,
	"replaced_at" bigint NOT NULL,
	CONSTRAINT "storage_ordered_replaced_workbench_id_extension_id_record_id_pk" PRIMARY KEY("workbench_id","extension_id","record_id")
);
--> statement-breakpoint
ALTER TABLE "storage_ordered_owners" ADD COLUMN "return_state" text;--> statement-breakpoint
ALTER TABLE "storage_ordered_replaced" ADD CONSTRAINT "storage_ordered_replaced_workbench_id_extension_id_storage_ordered_owners_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_ordered_owners"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;