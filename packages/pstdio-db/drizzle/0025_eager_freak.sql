CREATE TABLE "extension_automation_preferences" (
	"project_id" text NOT NULL,
	"extension_instance_id" text NOT NULL,
	"automation_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_automation_preferences_project_id_extension_instance_id_automation_id_pk" PRIMARY KEY("project_id","extension_instance_id","automation_id")
);
--> statement-breakpoint
ALTER TABLE "extension_automation_preferences" ADD CONSTRAINT "extension_automation_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_automation_preferences" ADD CONSTRAINT "extension_automation_preferences_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_automation_prefs_instance_idx" ON "extension_automation_preferences" USING btree ("extension_instance_id");