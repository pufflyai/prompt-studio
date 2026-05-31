CREATE TABLE "extension_settings" (
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_settings_owner_type_owner_id_extension_id_key_pk" PRIMARY KEY("owner_type","owner_id","extension_id","key")
);
--> statement-breakpoint
DROP INDEX "extension_instances_scope_namespace_uq";--> statement-breakpoint
DROP INDEX "installed_ext_install_name_uq";--> statement-breakpoint
CREATE INDEX "extension_settings_owner_idx" ON "extension_settings" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "extension_settings_extension_idx" ON "extension_settings" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "installed_ext_install_name_idx" ON "installed_extension_sources" USING btree ("install_name");--> statement-breakpoint
CREATE UNIQUE INDEX "installed_ext_source_path_uq" ON "installed_extension_sources" USING btree ("source_path");--> statement-breakpoint
ALTER TABLE "extension_instances" DROP COLUMN "namespace";