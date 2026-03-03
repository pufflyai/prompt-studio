export { createDocsService, isDocsServiceError } from "./services/docs";
export { createFilesService } from "./services/files";
export type { DiffMode, FileChange, GitDiffService } from "./services/git-diff";
export { createGitDiffService } from "./services/git-diff";
export type {
  AgentSettingsMap,
  ApprovalMode,
  ClaudeCodeSettings,
  OpencodeSettings,
  PstdioSettings,
} from "./services/settings";
export { createSettingsService } from "./services/settings";
export { createSkillsService } from "./services/skills";
export { ensureStorageRoot, resolveStorageRoot } from "./storage/paths";
