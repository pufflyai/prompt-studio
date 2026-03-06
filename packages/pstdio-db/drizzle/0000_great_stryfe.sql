CREATE TABLE "agent_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
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
	"size_bytes" integer NOT NULL,
	"hash" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_repos" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"repo_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"shorthand" text NOT NULL,
	"startup_script" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"path" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"project_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created" text,
	"last_request_started" text,
	"last_request_ended" text,
	"agent" text,
	"agent_session_id" text,
	"session_file_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"template_type" text NOT NULL,
	"file_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "ticket_files" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"file_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_default" boolean NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"can_drag_out" boolean NOT NULL,
	"can_drag_in" boolean NOT NULL,
	"can_create" boolean NOT NULL,
	"can_attempt_on_drop" boolean NOT NULL,
	"column_actions" text DEFAULT '[]' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "ticket_tag_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"ticket_tag_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "ticket_workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"shorthand" text NOT NULL,
	"project_id" text NOT NULL,
	"status_id" text,
	"title" text,
	"input" text,
	"priority" text,
	"parallelizable" text,
	"complexity" text,
	"parent_id" text,
	"blocked_reason" text,
	"depends_on" text,
	"archived" boolean DEFAULT false NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"file_id" text NOT NULL,
	"relative_path" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"session_id" text,
	"branch" text,
	"worktree_path" text,
	"status" text DEFAULT 'active' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"workspace_shorthand" text NOT NULL,
	"startup_log_file_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "ydoc_awareness" (
	"client_id" text NOT NULL,
	"project_id" text NOT NULL,
	"room" text NOT NULL,
	"op" "bytea" NOT NULL,
	"updated" text NOT NULL,
	CONSTRAINT "ydoc_awareness_client_id_room_project_id_pk" PRIMARY KEY("client_id","room","project_id")
);
--> statement-breakpoint
CREATE TABLE "ydoc_resume_state" (
	"project_id" text NOT NULL,
	"room" text NOT NULL,
	"offset" text NOT NULL,
	"handle" text NOT NULL,
	CONSTRAINT "ydoc_resume_state_project_id_room_pk" PRIMARY KEY("project_id","room")
);
--> statement-breakpoint
CREATE TABLE "ydoc_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"room" text NOT NULL,
	"op" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repos" ADD CONSTRAINT "project_repos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_repos" ADD CONSTRAINT "project_repos_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_session_file_id_files_id_fk" FOREIGN KEY ("session_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_files" ADD CONSTRAINT "ticket_files_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_files" ADD CONSTRAINT "ticket_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_statuses" ADD CONSTRAINT "ticket_statuses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" ADD CONSTRAINT "ticket_tag_assignments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tag_assignments" ADD CONSTRAINT "ticket_tag_assignments_ticket_tag_id_ticket_tags_id_fk" FOREIGN KEY ("ticket_tag_id") REFERENCES "public"."ticket_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_workspaces" ADD CONSTRAINT "ticket_workspaces_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_workspaces" ADD CONSTRAINT "ticket_workspaces_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_id_ticket_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."ticket_statuses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_artifacts" ADD CONSTRAINT "workspace_artifacts_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_artifacts" ADD CONSTRAINT "workspace_artifacts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_startup_log_file_id_files_id_fk" FOREIGN KEY ("startup_log_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ydoc_awareness" ADD CONSTRAINT "ydoc_awareness_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ydoc_resume_state" ADD CONSTRAINT "ydoc_resume_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ydoc_updates" ADD CONSTRAINT "ydoc_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_configs_agent_id_idx" ON "agent_configs" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_tag_assignments_ticket_tag_idx" ON "ticket_tag_assignments" USING btree ("ticket_id","ticket_tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_tags_project_name_idx" ON "ticket_tags" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_workspaces_ticket_workspace_idx" ON "ticket_workspaces" USING btree ("ticket_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_workspaces_workspace_idx" ON "ticket_workspaces" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_project_shorthand_idx" ON "tickets" USING btree ("project_id","shorthand");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_artifacts_ticket_path_idx" ON "workspace_artifacts" USING btree ("ticket_id","relative_path");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_project_workspace_shorthand_idx" ON "workspaces" USING btree ("project_id","workspace_shorthand");