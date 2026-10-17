ALTER TABLE "workspaces" ALTER COLUMN "provider_capabilities_json" SET DEFAULT '{"files":"write","diff":true,"merge":true,"rebase":true,"delete":true}'::jsonb;
--> statement-breakpoint
UPDATE "workspaces"
SET "provider_capabilities_json" = ("provider_capabilities_json" - 'archive') ||
  jsonb_build_object('delete', COALESCE("provider_capabilities_json" -> 'delete', "provider_capabilities_json" -> 'archive', 'false'::jsonb))
WHERE "provider_capabilities_json" ? 'archive';
