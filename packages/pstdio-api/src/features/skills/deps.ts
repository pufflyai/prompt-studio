import type { ExtensionsRouteDeps } from "../extensions/deps";

// Re-syncing skills into workspaces fires extension events, so skill routes
// reuse the full extension event deps.
export type SkillsRouteDeps = ExtensionsRouteDeps;
