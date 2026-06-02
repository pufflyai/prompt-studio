CREATE TABLE "extension_files" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_instance_id" text NOT NULL,
	"file_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "extension_files" ADD CONSTRAINT "extension_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_files" ADD CONSTRAINT "extension_files_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_files" ADD CONSTRAINT "extension_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "extension_files_instance_file_uq" ON "extension_files" USING btree ("extension_instance_id","file_id");--> statement-breakpoint
CREATE INDEX "extension_files_instance_scope_idx" ON "extension_files" USING btree ("extension_instance_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "extension_files_project_idx" ON "extension_files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "extension_files_file_idx" ON "extension_files" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_project_default_idx" ON "workspaces" USING btree ("project_id") WHERE "workspaces"."is_default" = true;