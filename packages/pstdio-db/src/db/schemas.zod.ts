import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  activity_events,
  extension_collection_items,
  extension_kv,
  extension_skill_preferences,
  extension_template_preferences,
  installed_extension_sources,
  project_extension_instances,
  sessions,
  ticket_tag_options,
  ticket_tags,
  tickets,
  workspaces,
  ydocAwareness,
  ydocResumeState,
  ydocUpdates,
} from "./schemas.pg";

export const resourceRefSchema = z.object({
  type: z.string(),
  id: z.string(),
  projectId: z.string().optional(),
  label: z.string().optional(),
  extensionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ResourceRefInput = z.infer<typeof resourceRefSchema>;

export const ticketSelectSchema = createSelectSchema(tickets);

export const sessionSelectSchema = createSelectSchema(sessions, {
  status: z.enum(["in_progress", "awaiting_input", "completed", "failed", "cancelled", "disconnected"]),
  anchors_json: z.array(resourceRefSchema),
});

export const ticketTagSelectSchema = createSelectSchema(ticket_tags);
export const ticketTagOptionSelectSchema = createSelectSchema(ticket_tag_options);
export const workspaceSelectSchema = createSelectSchema(workspaces, {
  anchors_json: z.array(resourceRefSchema),
});
export const activityEventSelectSchema = createSelectSchema(activity_events, {
  resource_type: z.string(),
  actor_type: z.enum(["user", "agent", "system"]),
  source: z.enum(["ui", "api", "hook", "system", "agent"]),
  payload_json: z.record(z.string(), z.unknown()),
});

export const installedExtensionSourceSelectSchema = createSelectSchema(installed_extension_sources, {
  manifest_json: z.record(z.string(), z.unknown()),
  last_error_json: z.record(z.string(), z.unknown()).nullable(),
});

export const projectExtensionInstanceSelectSchema = createSelectSchema(project_extension_instances, {
  config_json: z.record(z.string(), z.unknown()),
  diagnostics_json: z.record(z.string(), z.unknown()).nullable(),
});

export const extensionKvSelectSchema = createSelectSchema(extension_kv, {
  value_json: z.unknown(),
});

export const extensionCollectionItemSelectSchema = createSelectSchema(extension_collection_items, {
  value_json: z.unknown(),
});

export const extensionTemplatePreferenceSelectSchema = createSelectSchema(extension_template_preferences);
export const extensionSkillPreferenceSelectSchema = createSelectSchema(extension_skill_preferences);

export const ticketAttemptSchema = z.object({
  id: z.string(),
  label: z.string(),
  attempt_status_id: z.string().nullable(),
  updated_at: z.string(),
});

export const ticketSubTicketSchema = z.object({
  id: z.string(),
  shorthand: z.string(),
  status_id: z.string().nullable(),
  display_title: z.string().nullable(),
});

export const ticketApiSchema = ticketSelectSchema.extend({
  attempts: z.array(ticketAttemptSchema).optional(),
  tag_ids: z.array(z.string()).optional(),
  sub_tickets: z.array(ticketSubTicketSchema).optional(),
});

export const workspaceApiSchema = workspaceSelectSchema.extend({
  ticket_id: z.string().nullable(),
});

export const sessionApiSchema = sessionSelectSchema.extend({
  agent_session_status: z.enum(["connected", "disconnected", "not_connected"]).optional(),
  branch: z.string().nullable(),
  repo_id: z.string().nullable(),
  workspace_id: z.string().nullable(),
  worktree_path: z.string().nullable(),
});

export const createTicketBodySchema = ticketSelectSchema
  .omit({
    created_at: true,
    deleted_at: true,
    id: true,
    shorthand: true,
    updated_at: true,
  })
  .partial()
  .required({ project_id: true })
  .strict();

export const updateTicketBodySchema = ticketSelectSchema
  .omit({
    created_at: true,
    deleted_at: true,
    id: true,
    project_id: true,
    shorthand: true,
    updated_at: true,
  })
  .partial()
  .strict();

export const ydocUpdatesSelectSchema = createSelectSchema(ydocUpdates);
export const ydocAwarenessSelectSchema = createSelectSchema(ydocAwareness);
export const ydocResumeStateSelectSchema = createSelectSchema(ydocResumeState);
