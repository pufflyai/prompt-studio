ALTER TABLE "extension_collection_items" DROP CONSTRAINT "extension_collection_items_extension_instance_id_extension_instances_id_fk";
--> statement-breakpoint
ALTER TABLE "extension_files" DROP CONSTRAINT "extension_files_extension_instance_id_extension_instances_id_fk";
--> statement-breakpoint
ALTER TABLE "extension_kv" DROP CONSTRAINT "extension_kv_extension_instance_id_extension_instances_id_fk";
--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" DROP CONSTRAINT "extension_skill_preferences_extension_instance_id_extension_instances_id_fk";
--> statement-breakpoint
ALTER TABLE "extension_template_preferences" DROP CONSTRAINT "extension_template_preferences_extension_instance_id_extension_instances_id_fk";
--> statement-breakpoint
ALTER TABLE "extension_collection_items" ADD CONSTRAINT "extension_collection_items_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_files" ADD CONSTRAINT "extension_files_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_kv" ADD CONSTRAINT "extension_kv_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" ADD CONSTRAINT "extension_skill_preferences_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_template_preferences" ADD CONSTRAINT "extension_template_preferences_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;