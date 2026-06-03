export const standardResourceIcons = {
  project: "folder-root",
  workspace: "computer",
  worktree: "git-pull-request-draft",
  settings: "settings",
  dataRenderer: "table-properties",
} as const;

export type StandardResourceIcon = (typeof standardResourceIcons)[keyof typeof standardResourceIcons];
