export { createDocsService, isDocsServiceError } from "./services/docs";
export { createFilesService } from "./services/files";
export type { DiffMode, FileChange, GitDiffService } from "./services/git-diff";
export { createGitDiffService } from "./services/git-diff";
export { createSkillsService } from "./services/skills";
export { ensureStorageRoot, resolveStorageRoot } from "./storage/paths";
