CREATE TYPE "public"."activity_actor_type" AS ENUM('user', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."activity_source" AS ENUM('ui', 'api', 'hook', 'system', 'agent');--> statement-breakpoint
CREATE TYPE "public"."extension_load_status" AS ENUM('pending', 'loaded', 'error', 'missing', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."extension_reload_status" AS ENUM('success', 'error', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."extension_source_kind" AS ENUM('local_path', 'git', 'registry');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('in_progress', 'awaiting_input', 'queued', 'completed', 'failed', 'cancelled', 'disconnected');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"source_extension_id" text,
	"event_type" text NOT NULL,
	"actor_type" "activity_actor_type" NOT NULL,
	"actor_id" text,
	"source" "activity_source" NOT NULL,
	"summary" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_transfers" (
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"expected" jsonb NOT NULL,
	"cancelled_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "asset_transfers_project_id_extension_id_operation_id_pk" PRIMARY KEY("project_id","extension_id","operation_id")
);
--> statement-breakpoint
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
CREATE TABLE "board_default_views" (
	"project_id" text NOT NULL,
	"extension_instance_id" text,
	"board_id" text NOT NULL,
	"default_view_id" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "board_default_views_scope_unique" UNIQUE NULLS NOT DISTINCT("project_id","extension_instance_id","board_id")
);
--> statement-breakpoint
CREATE TABLE "board_views" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"extension_instance_id" text,
	"board_id" text NOT NULL,
	"title" text NOT NULL,
	"settings" jsonb NOT NULL,
	"filter" jsonb NOT NULL,
	"sorts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_environment" (
	"id" text PRIMARY KEY NOT NULL,
	"environment_id" text NOT NULL,
	CONSTRAINT "local_environment_single_owner" CHECK ("local_environment"."id" = 'local')
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
CREATE TABLE "extension_resource_sequences" (
	"project_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"kind" text NOT NULL,
	"prefix" text NOT NULL,
	"next_value" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_resource_sequences_project_id_extension_id_kind_pk" PRIMARY KEY("project_id","extension_id","kind")
);
--> statement-breakpoint
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
CREATE TABLE "extension_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"installed_extension_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"display_name_override" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"diagnostics_json" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_reload_events" (
	"id" text PRIMARY KEY NOT NULL,
	"installed_extension_id" text NOT NULL,
	"previous_source_hash" text,
	"next_source_hash" text,
	"previous_revision" text,
	"next_revision" text,
	"status" "extension_reload_status" NOT NULL,
	"error_json" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_settings" (
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_settings_owner_type_owner_id_extension_id_key_pk" PRIMARY KEY("owner_type","owner_id","extension_id","key")
);
--> statement-breakpoint
CREATE TABLE "extension_skill_preferences" (
	"project_id" text NOT NULL,
	"extension_instance_id" text NOT NULL,
	"skill_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_name_override" text,
	"description_override" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "extension_skill_preferences_project_id_extension_instance_id_skill_key_pk" PRIMARY KEY("project_id","extension_instance_id","skill_key")
);
--> statement-breakpoint
CREATE TABLE "installed_extension_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"install_name" text NOT NULL,
	"extension_id" text NOT NULL,
	"display_name" text NOT NULL,
	"version" text,
	"source_kind" "extension_source_kind" NOT NULL,
	"source_path" text NOT NULL,
	"source_ref" text,
	"manifest_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_hash" text,
	"loaded_revision" text,
	"status" "extension_load_status" DEFAULT 'pending' NOT NULL,
	"last_loaded_at" text,
	"last_error_json" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_kind" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint NOT NULL,
	"hash" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source" text NOT NULL,
	"origin" text NOT NULL,
	"source_extension_id" text,
	"actor_type" text,
	"actor_id" text,
	"title" text NOT NULL,
	"body" text,
	"kind" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"target_json" jsonb,
	"related_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata_json" jsonb,
	"dedupe_key" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"read_at" text,
	"resolved_at" text,
	"snoozed_until" text,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"shorthand" text NOT NULL,
	"default_agent_id" text,
	"default_agent_model" text,
	"startup_script" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "resource_anchors" (
	"project_id" text NOT NULL,
	"source_owner" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" text NOT NULL,
	"target_owner" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"role" text DEFAULT 'context' NOT NULL,
	"details" jsonb NOT NULL,
	CONSTRAINT "resource_anchors_project_id_source_owner_source_kind_source_id_target_owner_target_kind_target_id_pk" PRIMARY KEY("project_id","source_owner","source_kind","source_id","target_owner","target_kind","target_id")
);
--> statement-breakpoint
CREATE TABLE "session_queue_entries" (
	"queue_position" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_queue_entries_queue_position_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" text NOT NULL,
	"model" text,
	"steering_delivery_json" jsonb,
	"revision" text NOT NULL,
	"prompt" text NOT NULL,
	"request_kind" text DEFAULT 'start' NOT NULL,
	"question_response_json" jsonb,
	"attachments_json" jsonb,
	"params_json" jsonb,
	"dispatch_started_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"usage_json" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" "session_status" DEFAULT 'in_progress' NOT NULL,
	"project_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	"last_request_started" text,
	"last_request_ended" text,
	"agent" text,
	"last_selected_model" text,
	"agent_session_id" text,
	"session_file_id" text,
	"original_session_id" text,
	"cwd" text,
	"params_json" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"notifications_enabled" boolean DEFAULT false NOT NULL,
	"machine_tokens_enabled" boolean DEFAULT false NOT NULL,
	"max_concurrent_sessions" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_files" (
	"project_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"path" text NOT NULL,
	"file_id" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "skill_files_skill_id_path_pk" PRIMARY KEY("skill_id","path")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "storage_document_operations" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	CONSTRAINT "storage_document_operations_pk" PRIMARY KEY("workbench_id","extension_id","document_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "storage_document_updates" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_id" text NOT NULL,
	"revision" bigint NOT NULL,
	"update" "bytea" NOT NULL,
	CONSTRAINT "storage_document_updates_pk" PRIMARY KEY("workbench_id","extension_id","document_id","revision")
);
--> statement-breakpoint
CREATE TABLE "storage_documents" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_id" text NOT NULL,
	"state" "bytea" NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"folded_revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "storage_documents_workbench_id_extension_id_document_id_pk" PRIMARY KEY("workbench_id","extension_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "storage_record_outbox" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"frame" "bytea" NOT NULL,
	"assets" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_record_sync" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"joined" boolean DEFAULT false NOT NULL,
	"after" bigint DEFAULT 0 NOT NULL,
	"state_id" text,
	"through" bigint DEFAULT 0 NOT NULL,
	"pending_bytes" bigint DEFAULT 0 NOT NULL,
	"state_bytes" bigint DEFAULT 0 NOT NULL,
	"skipped" boolean DEFAULT false NOT NULL,
	CONSTRAINT "storage_record_sync_workbench_id_extension_id_pk" PRIMARY KEY("workbench_id","extension_id")
);
--> statement-breakpoint
CREATE TABLE "storage_current_records" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"record_id" text NOT NULL,
	"deleted" boolean NOT NULL,
	"value" jsonb,
	"asset" jsonb,
	"shared" jsonb,
	"revision" text NOT NULL,
	CONSTRAINT "storage_current_records_workbench_id_extension_id_record_id_pk" PRIMARY KEY("workbench_id","extension_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "storage_record_indexes" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"database_name" text NOT NULL,
	CONSTRAINT "storage_record_indexes_workbench_id_extension_id_name_pk" PRIMARY KEY("workbench_id","extension_id","name")
);
--> statement-breakpoint
CREATE TABLE "storage_record_projections" (
	"workbench_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"document_id" text DEFAULT 'records' NOT NULL,
	"revision" bigint NOT NULL,
	"live_count" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "storage_record_projections_workbench_id_extension_id_pk" PRIMARY KEY("workbench_id","extension_id")
);
--> statement-breakpoint
CREATE TABLE "storage_resource_aliases" (
	"workbench_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"shorthand" text NOT NULL,
	CONSTRAINT "storage_resource_aliases_workbench_id_resource_id_shorthand_pk" PRIMARY KEY("workbench_id","resource_id","shorthand")
);
--> statement-breakpoint
CREATE TABLE "storage_resource_identities" (
	"workbench_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"extension_id" text NOT NULL,
	"kind" text NOT NULL,
	"shorthand" text NOT NULL,
	CONSTRAINT "storage_resource_identities_workbench_id_resource_id_pk" PRIMARY KEY("workbench_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "storage_resource_projections" (
	"workbench_id" text NOT NULL,
	"extension_id" text DEFAULT 'pstdio' NOT NULL,
	"document_id" text DEFAULT 'resource-identities' NOT NULL,
	"revision" bigint NOT NULL,
	CONSTRAINT "storage_resource_projections_workbench_id_pk" PRIMARY KEY("workbench_id")
);
--> statement-breakpoint
CREATE TABLE "webview_preferences" (
	"extension_id" text NOT NULL,
	"name" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "webview_preferences_extension_id_name_scope_type_scope_id_pk" PRIMARY KEY("extension_id","name","scope_type","scope_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"session_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"branch" text,
	"root_path" text,
	"provider_id" text DEFAULT 'pstdio.root' NOT NULL,
	"provider_params_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_ref_json" jsonb,
	"provider_state" text DEFAULT 'ready' NOT NULL,
	"execution_kind" text DEFAULT 'local' NOT NULL,
	"provider_operation_id" text,
	"provider_operation_kind" text,
	"provider_error_json" jsonb,
	"provider_capabilities_json" jsonb DEFAULT '{"files":"write","diff":true,"merge":true,"rebase":true,"delete":true}'::jsonb NOT NULL,
	"display_path" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"workspace_shorthand" text NOT NULL,
	"initializing" boolean DEFAULT false NOT NULL,
	"setup_error" text,
	"startup_log_file_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_source_extension_id_installed_extension_sources_id_fk" FOREIGN KEY ("source_extension_id") REFERENCES "public"."installed_extension_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_principals" ADD CONSTRAINT "automation_principals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run_events" ADD CONSTRAINT "automation_run_events_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_principal_id_automation_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."automation_principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_token_id_automation_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."automation_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_tokens" ADD CONSTRAINT "automation_tokens_principal_id_automation_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."automation_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_tokens" ADD CONSTRAINT "automation_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_default_views" ADD CONSTRAINT "board_default_views_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_default_views" ADD CONSTRAINT "board_default_views_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_views" ADD CONSTRAINT "board_views_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_views" ADD CONSTRAINT "board_views_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_connections" ADD CONSTRAINT "extension_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_resource_sequences" ADD CONSTRAINT "extension_resource_sequences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_automation_preferences" ADD CONSTRAINT "extension_automation_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_automation_preferences" ADD CONSTRAINT "extension_automation_preferences_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_files" ADD CONSTRAINT "extension_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_files" ADD CONSTRAINT "extension_files_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_files" ADD CONSTRAINT "extension_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_instances" ADD CONSTRAINT "extension_instances_installed_extension_id_installed_extension_sources_id_fk" FOREIGN KEY ("installed_extension_id") REFERENCES "public"."installed_extension_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_reload_events" ADD CONSTRAINT "extension_reload_events_installed_extension_id_installed_extension_sources_id_fk" FOREIGN KEY ("installed_extension_id") REFERENCES "public"."installed_extension_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" ADD CONSTRAINT "extension_skill_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_skill_preferences" ADD CONSTRAINT "extension_skill_preferences_extension_instance_id_extension_instances_id_fk" FOREIGN KEY ("extension_instance_id") REFERENCES "public"."extension_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_anchors" ADD CONSTRAINT "resource_anchors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_queue_entries" ADD CONSTRAINT "session_queue_entries_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_session_file_id_files_id_fk" FOREIGN KEY ("session_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_document_operations" ADD CONSTRAINT "storage_document_operations_document_fk" FOREIGN KEY ("workbench_id","extension_id","document_id") REFERENCES "public"."storage_documents"("workbench_id","extension_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_document_updates" ADD CONSTRAINT "storage_document_updates_document_fk" FOREIGN KEY ("workbench_id","extension_id","document_id") REFERENCES "public"."storage_documents"("workbench_id","extension_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_documents" ADD CONSTRAINT "storage_documents_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_outbox" ADD CONSTRAINT "storage_record_outbox_sync_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_record_sync"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_sync" ADD CONSTRAINT "storage_record_sync_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_current_records" ADD CONSTRAINT "storage_current_records_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_current_records" ADD CONSTRAINT "storage_current_records_workbench_id_extension_id_storage_record_projections_workbench_id_extension_id_fk" FOREIGN KEY ("workbench_id","extension_id") REFERENCES "public"."storage_record_projections"("workbench_id","extension_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_indexes" ADD CONSTRAINT "storage_record_indexes_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_projections" ADD CONSTRAINT "storage_record_projections_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_record_projections" ADD CONSTRAINT "storage_record_projections_workbench_id_extension_id_document_id_storage_documents_workbench_id_extension_id_document_id_fk" FOREIGN KEY ("workbench_id","extension_id","document_id") REFERENCES "public"."storage_documents"("workbench_id","extension_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_aliases" ADD CONSTRAINT "storage_resource_aliases_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_aliases" ADD CONSTRAINT "storage_resource_aliases_workbench_id_storage_resource_projections_workbench_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."storage_resource_projections"("workbench_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_identities" ADD CONSTRAINT "storage_resource_identities_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_identities" ADD CONSTRAINT "storage_resource_identities_workbench_id_storage_resource_projections_workbench_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."storage_resource_projections"("workbench_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_projections" ADD CONSTRAINT "storage_resource_projections_workbench_id_projects_id_fk" FOREIGN KEY ("workbench_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_resource_projections" ADD CONSTRAINT "storage_resource_projections_workbench_id_extension_id_document_id_storage_documents_workbench_id_extension_id_document_id_fk" FOREIGN KEY ("workbench_id","extension_id","document_id") REFERENCES "public"."storage_documents"("workbench_id","extension_id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD CONSTRAINT "workspace_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_sessions" ADD CONSTRAINT "workspace_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_startup_log_file_id_files_id_fk" FOREIGN KEY ("startup_log_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_project_created_id_idx" ON "activity_events" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE INDEX "activity_events_resource_created_id_idx" ON "activity_events" USING btree ("project_id","resource_type","resource_id","created_at","id");--> statement-breakpoint
CREATE INDEX "activity_events_source_extension_idx" ON "activity_events" USING btree ("source_extension_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_idempotency_idx" ON "automation_runs" USING btree ("principal_id","project_id","command_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_tokens_prefix_idx" ON "automation_tokens" USING btree ("token_prefix");--> statement-breakpoint
CREATE INDEX "board_views_scope_order_idx" ON "board_views" USING btree ("project_id","extension_instance_id","board_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "extension_connections_project_contribution_idx" ON "extension_connections" USING btree ("project_id","extension_id","contribution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extension_resource_sequences_project_prefix_uq" ON "extension_resource_sequences" USING btree ("project_id","prefix");--> statement-breakpoint
CREATE INDEX "extension_automation_prefs_instance_idx" ON "extension_automation_preferences" USING btree ("extension_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extension_files_instance_file_uq" ON "extension_files" USING btree ("extension_instance_id","file_id");--> statement-breakpoint
CREATE INDEX "extension_files_instance_scope_idx" ON "extension_files" USING btree ("extension_instance_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "extension_files_project_idx" ON "extension_files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "extension_files_file_idx" ON "extension_files" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extension_instances_scope_installed_uq" ON "extension_instances" USING btree ("scope_type","scope_id","installed_extension_id");--> statement-breakpoint
CREATE INDEX "extension_instances_scope_idx" ON "extension_instances" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "extension_instances_installed_idx" ON "extension_instances" USING btree ("installed_extension_id");--> statement-breakpoint
CREATE INDEX "extension_reload_events_installed_idx" ON "extension_reload_events" USING btree ("installed_extension_id","created_at");--> statement-breakpoint
CREATE INDEX "extension_settings_owner_idx" ON "extension_settings" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "extension_settings_extension_idx" ON "extension_settings" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "extension_skill_prefs_instance_idx" ON "extension_skill_preferences" USING btree ("extension_instance_id");--> statement-breakpoint
CREATE INDEX "installed_ext_install_name_idx" ON "installed_extension_sources" USING btree ("install_name");--> statement-breakpoint
CREATE UNIQUE INDEX "installed_ext_source_path_uq" ON "installed_extension_sources" USING btree ("source_path");--> statement-breakpoint
CREATE INDEX "installed_ext_extension_id_idx" ON "installed_extension_sources" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "installed_ext_status_idx" ON "installed_extension_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_project_status_updated_idx" ON "notifications" USING btree ("project_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "notifications_project_priority_status_idx" ON "notifications" USING btree ("project_id","priority","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_project_live_dedupe_unique" ON "notifications" USING btree ("project_id","dedupe_key") WHERE "notifications"."dedupe_key" IS NOT NULL AND "notifications"."status" IN ('open', 'read', 'snoozed');--> statement-breakpoint
CREATE INDEX "notifications_project_source_status_idx" ON "notifications" USING btree ("project_id","source_extension_id","status");--> statement-breakpoint
CREATE INDEX "resource_anchors_target_idx" ON "resource_anchors" USING btree ("project_id","target_owner","target_kind","target_id","source_owner","source_kind","source_id");--> statement-breakpoint
CREATE INDEX "session_queue_entries_session_id_idx" ON "session_queue_entries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_project_created_id_idx" ON "sessions" USING btree ("project_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_files_skill_file_idx" ON "skill_files" USING btree ("skill_id","file_id");--> statement-breakpoint
CREATE INDEX "storage_record_outbox_owner_idx" ON "storage_record_outbox" USING btree ("workbench_id","extension_id","sequence");--> statement-breakpoint
CREATE INDEX "storage_resource_identity_alias" ON "storage_resource_aliases" USING btree ("workbench_id","shorthand","resource_id");--> statement-breakpoint
CREATE INDEX "storage_resource_identity_number" ON "storage_resource_identities" USING btree ("workbench_id","extension_id","kind","shorthand","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_sessions_ws_session_idx" ON "workspace_sessions" USING btree ("workspace_id","session_id");--> statement-breakpoint
CREATE INDEX "workspace_sessions_session_idx" ON "workspace_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_project_workspace_shorthand_idx" ON "workspaces" USING btree ("project_id","workspace_shorthand");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_project_default_idx" ON "workspaces" USING btree ("project_id") WHERE "workspaces"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_project_active_name_idx" ON "workspaces" USING btree ("project_id","name") WHERE "workspaces"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_active_root_path_idx" ON "workspaces" USING btree ("root_path") WHERE "workspaces"."deleted_at" is null;