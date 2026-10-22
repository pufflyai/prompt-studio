CREATE TABLE "storage_record_actor_clocks" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"client" bigint NOT NULL,
	"clock" bigint NOT NULL,
	CONSTRAINT "storage_record_actor_clocks_workbench_id_extension_id_client_pk" PRIMARY KEY("workbench_id","extension_id","client")
);
--> statement-breakpoint
CREATE TABLE "storage_record_fragments" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"record_id" text NOT NULL,
	"state" "bytea" NOT NULL,
	CONSTRAINT "storage_record_fragments_workbench_id_extension_id_record_id_pk" PRIMARY KEY("workbench_id","extension_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "storage_record_ownership" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"client" bigint NOT NULL,
	"start_clock" bigint NOT NULL,
	"end_clock" bigint NOT NULL,
	"record_id" text NOT NULL,
	CONSTRAINT "storage_record_ownership_pk" PRIMARY KEY("workbench_id","extension_id","client","start_clock")
);
--> statement-breakpoint
CREATE TABLE "storage_current_records" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"record_id" text NOT NULL,
	"deleted" boolean NOT NULL,
	"value" jsonb,
	"asset" jsonb,
	"shared" jsonb,
	"revision" text NOT NULL,
	CONSTRAINT "storage_current_records_workbench_id_extension_id_record_id_pk" PRIMARY KEY("workbench_id","extension_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "storage_record_indexes" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"database_name" text NOT NULL,
	CONSTRAINT "storage_record_indexes_workbench_id_extension_id_name_pk" PRIMARY KEY("workbench_id","extension_id","name")
);
--> statement-breakpoint
CREATE TABLE "storage_record_projections" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_id" text DEFAULT 'records' NOT NULL,
	"revision" bigint NOT NULL,
	CONSTRAINT "storage_record_projections_workbench_id_extension_id_pk" PRIMARY KEY("workbench_id","extension_id")
);
--> statement-breakpoint
CREATE TABLE "storage_record_types" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"type_name" text NOT NULL,
	"type_kind" text NOT NULL,
	"record_id" text NOT NULL,
	CONSTRAINT "storage_record_types_workbench_id_extension_id_type_name_pk" PRIMARY KEY("workbench_id","extension_id","type_name")
);
--> statement-breakpoint
CREATE TABLE "storage_resource_aliases" (
	"workbench_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"shorthand" text NOT NULL,
	CONSTRAINT "storage_resource_aliases_workbench_id_resource_id_shorthand_pk" PRIMARY KEY("workbench_id","resource_id","shorthand")
);
--> statement-breakpoint
CREATE TABLE "storage_resource_identities" (
	"workbench_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"kind" text NOT NULL,
	"shorthand" text NOT NULL,
	CONSTRAINT "storage_resource_identities_workbench_id_resource_id_pk" PRIMARY KEY("workbench_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "storage_resource_projections" (
	"workbench_id" text NOT NULL,
	"extension_id" text DEFAULT 'pstdio' NOT NULL,
	"document_id" text DEFAULT 'resource-identities' NOT NULL,
	"revision" bigint NOT NULL,
	CONSTRAINT "storage_resource_projections_workbench_id_pk" PRIMARY KEY("workbench_id")
);
--> statement-breakpoint
ALTER TABLE "storage_record_actor_clocks" ADD CONSTRAINT "storage_record_actor_clocks_workbench_id_extension_id_storage_record_projections_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_record_projections"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_fragments" ADD CONSTRAINT "storage_record_fragments_workbench_id_extension_id_storage_record_projections_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_record_projections"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_ownership" ADD CONSTRAINT "storage_record_ownership_workbench_id_extension_id_storage_record_projections_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_record_projections"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_current_records" ADD CONSTRAINT "storage_current_records_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_current_records" ADD CONSTRAINT "storage_current_records_workbench_id_extension_id_storage_record_projections_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_record_projections"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_indexes" ADD CONSTRAINT "storage_record_indexes_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_projections" ADD CONSTRAINT "storage_record_projections_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_projections" ADD CONSTRAINT "storage_record_projections_workbench_id_extension_id_document_id_storage_documents_workbench_id_extension_id_document_id_fk" FOREIGN KEY ("workbench_id","extension_id","document_id") REFERENCES "public"."storage_documents"("workbench_id","extension_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_types" ADD CONSTRAINT "storage_record_types_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_types" ADD CONSTRAINT "storage_record_types_workbench_id_extension_id_storage_record_projections_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_record_projections"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_aliases" ADD CONSTRAINT "storage_resource_aliases_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_aliases" ADD CONSTRAINT "storage_resource_aliases_workbench_id_storage_resource_projections_workbench_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."storage_resource_projections"("workbench_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_identities" ADD CONSTRAINT "storage_resource_identities_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_identities" ADD CONSTRAINT "storage_resource_identities_workbench_id_storage_resource_projections_workbench_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."storage_resource_projections"("workbench_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_projections" ADD CONSTRAINT "storage_resource_projections_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_projections" ADD CONSTRAINT "storage_resource_projections_workbench_id_extension_id_document_id_storage_documents_workbench_id_extension_id_document_id_fk" FOREIGN KEY ("workbench_id","extension_id","document_id") REFERENCES "public"."storage_documents"("workbench_id","extension_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_resource_identity_alias" ON "storage_resource_aliases" USING btree ("workbench_id","shorthand","resource_id");--> statement-breakpoint
CREATE INDEX "storage_resource_identity_number" ON "storage_resource_identities" USING btree ("workbench_id","extension_id","kind","shorthand","resource_id");