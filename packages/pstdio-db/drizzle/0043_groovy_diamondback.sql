CREATE TABLE "asset_transfers" (
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"expected" jsonb NOT NULL,
	"cancelled_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "asset_transfers_project_id_extension_id_operation_id_pk" PRIMARY KEY("project_id","extension_id","operation_id")
);
--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "size_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;