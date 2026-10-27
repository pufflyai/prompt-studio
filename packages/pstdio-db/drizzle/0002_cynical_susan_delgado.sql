CREATE TABLE "artifact_file_projection_roots" (
	"projection_key" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_file_projections" (
	"projection_key" text NOT NULL,
	"path" text NOT NULL,
	"state" jsonb NOT NULL,
	CONSTRAINT "artifact_file_projections_projection_key_path_pk" PRIMARY KEY("projection_key","path")
);
--> statement-breakpoint
CREATE TABLE "native_document_file_projections" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_key" text NOT NULL,
	"baseline" "bytea" NOT NULL,
	"pending" "bytea",
	CONSTRAINT "native_document_file_projections_pk" PRIMARY KEY("workbench_id","extension_id","document_key")
);
--> statement-breakpoint
CREATE TABLE "native_document_room_updates" (
	"room_id" text NOT NULL,
	"revision" bigint NOT NULL,
	"update" "bytea" NOT NULL,
	CONSTRAINT "native_document_room_updates_room_id_revision_pk" PRIMARY KEY("room_id","revision")
);
--> statement-breakpoint
CREATE TABLE "native_document_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_key" text NOT NULL,
	"state" "bytea" NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"folded_revision" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "native_document_sources" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_key" text NOT NULL,
	"target" jsonb NOT NULL,
	CONSTRAINT "native_document_sources_workbench_id_extension_id_document_key_pk" PRIMARY KEY("workbench_id","extension_id","document_key")
);
--> statement-breakpoint
ALTER TABLE "artifact_file_projections" ADD CONSTRAINT "artifact_file_projections_projection_key_artifact_file_projection_roots_projection_key_fk" FOREIGN KEY ("projection_key") REFERENCES "public"."artifact_file_projection_roots"("projection_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_document_file_projections" ADD CONSTRAINT "native_document_file_projections_source_fk" FOREIGN KEY ("workbench_id","extension_id","document_key") REFERENCES "public"."native_document_sources"("workbench_id","extension_id","document_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_document_room_updates" ADD CONSTRAINT "native_document_room_updates_room_id_native_document_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."native_document_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_document_rooms" ADD CONSTRAINT "native_document_rooms_workbench_id_extension_id_document_key_native_document_sources_workbench_id_extension_id_document_key_fk" FOREIGN KEY ("workbench_id","extension_id","document_key") REFERENCES "public"."native_document_sources"("workbench_id","extension_id","document_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_document_sources" ADD CONSTRAINT "native_document_sources_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;