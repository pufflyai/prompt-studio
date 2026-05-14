import { pgEnum } from "drizzle-orm/pg-core";

export const sessionStatusEnum = pgEnum("session_status", [
  "in_progress",
  "awaiting_input",
  "queued",
  "completed",
  "failed",
  "cancelled",
  "disconnected",
]);

export const activityActorTypeEnum = pgEnum("activity_actor_type", ["user", "agent", "system"]);
export const activitySourceEnum = pgEnum("activity_source", ["ui", "api", "hook", "system", "agent"]);

export const extensionSourceKindEnum = pgEnum("extension_source_kind", ["local_path", "git", "registry", "builtin"]);

export const extensionLoadStatusEnum = pgEnum("extension_load_status", [
  "pending",
  "loaded",
  "error",
  "missing",
  "disabled",
]);

export const extensionReloadStatusEnum = pgEnum("extension_reload_status", ["success", "error", "skipped"]);

export const templateDefaultSourceEnum = pgEnum("template_default_source", ["project_template", "extension_template"]);
