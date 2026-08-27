CREATE TABLE "automation_principals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"disabled_at" text
);
--> statement-breakpoint
CREATE TABLE "automation_run_events" (
	"cursor" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "automation_run_events_cursor_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"type" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"principal_id" text NOT NULL,
	"token_id" text,
	"command_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"input_hash" text NOT NULL,
	"input_json" jsonb NOT NULL,
	"status" text NOT NULL,
	"result_json" jsonb,
	"error_json" jsonb,
	"created_at" text NOT NULL,
	"started_at" text,
	"finished_at" text
);
--> statement-breakpoint
CREATE TABLE "automation_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"principal_id" text NOT NULL,
	"token_prefix" text NOT NULL,
	"token_digest" text NOT NULL,
	"project_id" text NOT NULL,
	"command_scopes_json" jsonb NOT NULL,
	"expires_at" text NOT NULL,
	"last_used_at" text,
	"revoked_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"contribution_id" text NOT NULL,
	"base_url" text NOT NULL,
	"auth_type" text NOT NULL,
	"auth_header_name" text,
	"secret_ref" text,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_check_json" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_principals" ADD CONSTRAINT "automation_principals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run_events" ADD CONSTRAINT "automation_run_events_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_principal_id_automation_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."automation_principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_token_id_automation_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."automation_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_tokens" ADD CONSTRAINT "automation_tokens_principal_id_automation_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."automation_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_tokens" ADD CONSTRAINT "automation_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_connections" ADD CONSTRAINT "extension_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_idempotency_idx" ON "automation_runs" USING btree ("principal_id","project_id","command_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_tokens_prefix_idx" ON "automation_tokens" USING btree ("token_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "extension_connections_project_contribution_idx" ON "extension_connections" USING btree ("project_id","extension_id","contribution_id");