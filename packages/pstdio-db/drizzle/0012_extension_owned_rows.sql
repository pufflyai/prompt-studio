ALTER TABLE "templates" ALTER COLUMN "file_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "extension_id" text;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "skill_key" text;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "extension_id" text;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "template_key" text;