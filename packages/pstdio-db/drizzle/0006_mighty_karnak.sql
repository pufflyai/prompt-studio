ALTER TABLE "skills" ADD COLUMN "files_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ALTER COLUMN "file_id" DROP NOT NULL;
