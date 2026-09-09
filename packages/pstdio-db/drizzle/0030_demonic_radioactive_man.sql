CREATE TABLE "extension_resource_sequences" (
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"kind" text NOT NULL,
	"prefix" text NOT NULL,
	"next_value" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_resource_sequences_project_id_extension_id_kind_pk" PRIMARY KEY("project_id","extension_id","kind")
);
--> statement-breakpoint
ALTER TABLE "extension_resource_sequences" ADD CONSTRAINT "extension_resource_sequences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "extension_resource_sequences_project_prefix_uq" ON "extension_resource_sequences" USING btree ("project_id","prefix");