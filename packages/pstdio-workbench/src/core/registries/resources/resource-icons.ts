export const standardResourceIcons = {
  project: "folder-root",
  workspace: "computer",
  worktree: "git-pull-request-draft",
  settings: "settings",
} as const;

export type StandardResourceIcon = (typeof standardResourceIcons)[keyof typeof standardResourceIcons];
