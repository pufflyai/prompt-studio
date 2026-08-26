ALTER TABLE "workspaces" ADD COLUMN "provider_id" text DEFAULT 'pstdio.root' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "provider_params_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "provider_ref_json" jsonb;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "provider_state" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "execution_kind" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "provider_operation_id" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "provider_operation_kind" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "provider_error_json" jsonb;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "provider_capabilities_json" jsonb DEFAULT '{"files":"write","diff":true,"merge":true,"rebase":true,"archive":true,"delete":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "display_path" text;