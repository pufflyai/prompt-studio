CREATE TABLE "storage_document_operations" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	CONSTRAINT "storage_document_operations_pk" PRIMARY KEY("workbench_id","extension_id","document_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "storage_document_updates" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_id" text NOT NULL,
	"revision" bigint NOT NULL,
	"update" "bytea" NOT NULL,
	CONSTRAINT "storage_document_updates_pk" PRIMARY KEY("workbench_id","extension_id","document_id","revision")
);
--> statement-breakpoint
CREATE TABLE "storage_documents" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_id" text NOT NULL,
	"state" "bytea" NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"folded_revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "storage_documents_workbench_id_extension_id_document_id_pk" PRIMARY KEY("workbench_id","extension_id","document_id")
);
--> statement-breakpoint
ALTER TABLE "storage_document_operations" ADD CONSTRAINT "storage_document_operations_document_fk" FOREIGN KEY ("workbench_id","extension_id","document_id") REFERENCES "public"."storage_documents"("workbench_id","extension_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_document_updates" ADD CONSTRAINT "storage_document_updates_document_fk" FOREIGN KEY ("workbench_id","extension_id","document_id") REFERENCES "public"."storage_documents"("workbench_id","extension_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_documents" ADD CONSTRAINT "storage_documents_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;