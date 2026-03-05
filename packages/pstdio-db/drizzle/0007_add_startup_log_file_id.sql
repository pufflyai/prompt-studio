ALTER TABLE "workspaces" ADD COLUMN "startup_log_file_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_startup_log_file_id_files_id_fk" FOREIGN KEY ("startup_log_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
