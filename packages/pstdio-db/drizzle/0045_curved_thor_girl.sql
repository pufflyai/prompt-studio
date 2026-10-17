CREATE TABLE "extension_data_versions" (
	"extension_instance_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"version" bigint NOT NULL,
	CONSTRAINT "extension_data_versions_extension_instance_id_scope_type_scope_id_pk" PRIMARY KEY("extension_instance_id","scope_type","scope_id")
);
--> statement-breakpoint
ALTER TABLE "extension_data_versions" ADD CONSTRAINT "extension_data_versions_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE cascade ON UPDATE no action;