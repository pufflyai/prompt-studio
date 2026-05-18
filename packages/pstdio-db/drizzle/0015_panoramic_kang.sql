ALTER TABLE "installed_extension_sources" ALTER COLUMN "source_kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."extension_source_kind";--> statement-breakpoint
CREATE TYPE "public"."extension_source_kind" AS ENUM('local_path', 'git', 'registry');--> statement-breakpoint
ALTER TABLE "installed_extension_sources" ALTER COLUMN "source_kind" SET DATA TYPE "public"."extension_source_kind" USING "source_kind"::"public"."extension_source_kind";