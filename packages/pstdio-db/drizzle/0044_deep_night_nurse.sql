CREATE TABLE "extension_storage_journal" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"ordinal" bigint NOT NULL,
	"input_fingerprint" text NOT NULL,
	"mutation_json" jsonb NOT NULL,
	"acceptance_json" jsonb,
	CONSTRAINT "extension_storage_journal_workbench_id_extension_id_operation_id_pk" PRIMARY KEY("workbench_id","extension_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "extension_storage_owners" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"accepted_json" jsonb,
	CONSTRAINT "extension_storage_owners_workbench_id_extension_id_pk" PRIMARY KEY("workbench_id","extension_id")
);
--> statement-breakpoint
ALTER TABLE "extension_storage_journal" ADD CONSTRAINT "extension_storage_journal_workbench_id_extension_id_extension_storage_owners_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."extension_storage_owners"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_storage_owners" ADD CONSTRAINT "extension_storage_owners_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_storage_journal_order_idx" ON "extension_storage_journal" USING btree ("workbench_id","extension_id","ordinal");