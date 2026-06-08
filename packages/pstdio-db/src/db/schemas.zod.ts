import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { activity_events, sessions, workspaces, ydocAwareness, ydocResumeState, ydocUpdates } from "./schemas.pg";

export const sessionSelectSchema = createSelectSchema(sessions, {
  status: z.enum(["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"]),
});

export const workspaceSelectSchema = createSelectSchema(workspaces);
export const activityEventSelectSchema = createSelectSchema(activity_events, {
  resource_type: z.string(),
  actor_type: z.enum(["user", "agent", "system"]),
  source: z.enum(["ui", "api", "hook", "system", "agent"]),
  payload_json: z.record(z.string(), z.unknown()),
});

export const workspaceApiSchema = workspaceSelectSchema;

export const sessionApiSchema = sessionSelectSchema.extend({
  agent_session_status: z.enum(["connected", "disconnected", "not_connected"]).optional(),
  branch: z.string().nullable(),
  repo_id: z.string().nullable(),
  workspace_id: z.string().nullable(),
  worktree_path: z.string().nullable(),
});

export const ydocUpdatesSelectSchema = createSelectSchema(ydocUpdates);
export const ydocAwarenessSelectSchema = createSelectSchema(ydocAwareness);
export const ydocResumeStateSelectSchema = createSelectSchema(ydocResumeState);
