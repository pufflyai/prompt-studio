CREATE TABLE "credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"extension_id" text NOT NULL,
	"contribution_id" text NOT NULL,
	"project_id" text,
	"provider" text NOT NULL,
	"account_label" text,
	"auth_type" text NOT NULL,
	"auth_header_name" text,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"secret_ref" text NOT NULL,
	"expires_at" text,
	"last_check" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "credentials_owner_uq" UNIQUE NULLS NOT DISTINCT("extension_id","contribution_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"scope" text NOT NULL,
	"scope_id" text NOT NULL,
	"extension_id" text DEFAULT '' NOT NULL,
	"key" text NOT NULL,
	"sync" text NOT NULL,
	"value" jsonb,
	"project_id" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "preferences_scope_scope_id_extension_id_key_pk" PRIMARY KEY("scope","scope_id","extension_id","key")
);
--> statement-breakpoint
ALTER TABLE "automation_principals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_default_views" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "local_environment" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "extension_connections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "extension_automation_preferences" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "extension_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webview_preferences" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automation_runs" DROP CONSTRAINT "automation_runs_principal_id_automation_principals_id_fk";
--> statement-breakpoint
ALTER TABLE "automation_tokens" DROP CONSTRAINT "automation_tokens_principal_id_automation_principals_id_fk";
--> statement-breakpoint
DROP TABLE "automation_principals" CASCADE;--> statement-breakpoint
DROP TABLE "board_default_views" CASCADE;--> statement-breakpoint
DROP TABLE "local_environment" CASCADE;--> statement-breakpoint
DROP TABLE "extension_connections" CASCADE;--> statement-breakpoint
DROP TABLE "extension_automation_preferences" CASCADE;--> statement-breakpoint
DROP TABLE "extension_settings" CASCADE;--> statement-breakpoint
DROP TABLE "extension_skill_preferences" CASCADE;--> statement-breakpoint
DROP TABLE "settings" CASCADE;--> statement-breakpoint
DROP TABLE "webview_preferences" CASCADE;--> statement-breakpoint
DROP TABLE "workspace_sessions" CASCADE;--> statement-breakpoint
DROP INDEX "automation_runs_idempotency_idx";--> statement-breakpoint
ALTER TABLE "automation_runs" ADD COLUMN "principal" text NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_tokens" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_tokens" ADD COLUMN "created_by" text NOT NULL;--> statement-breakpoint
ALTER TABLE "board_views" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credentials_project_idx" ON "credentials" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "preferences_extension_idx" ON "preferences" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "preferences_project_idx" ON "preferences" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_tokens_project_idx" ON "automation_tokens" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "board_views_default_scope_idx" ON "board_views" USING btree ("project_id",coalesce("extension_instance_id", ''),"board_id") WHERE "board_views"."is_default" = true;--> statement-breakpoint
CREATE INDEX "sessions_workspace_idx" ON "sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_idempotency_idx" ON "automation_runs" USING btree ("principal","project_id","command_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "automation_runs" DROP COLUMN "principal_id";--> statement-breakpoint
ALTER TABLE "automation_tokens" DROP COLUMN "principal_id";