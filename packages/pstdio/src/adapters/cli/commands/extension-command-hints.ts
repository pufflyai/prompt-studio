export type ExtensionCommandHint = {
  path: string;
  extensionId: string;
};

const firstPartyCommandHints: ExtensionCommandHint[] = [
  { path: "tickets archive", extensionId: "pstdio.planner" },
  { path: "tickets create", extensionId: "pstdio.planner" },
  { path: "tickets delete", extensionId: "pstdio.planner" },
  { path: "tickets files", extensionId: "pstdio.planner" },
  { path: "tickets implement", extensionId: "pstdio.planner" },
  { path: "tickets list", extensionId: "pstdio.planner" },
  { path: "tickets pull", extensionId: "pstdio.planner" },
  { path: "tickets push", extensionId: "pstdio.planner" },
  { path: "tickets save", extensionId: "pstdio.planner" },
  { path: "tickets update", extensionId: "pstdio.planner" },
  { path: "tickets update-when-attempt-status", extensionId: "pstdio.planner" },
  { path: "tickets view", extensionId: "pstdio.planner" },
  { path: "tickets workspaces", extensionId: "pstdio.planner" },
  { path: "tickets worktrees list", extensionId: "pstdio.planner" },
  { path: "tickets worktrees remove-all", extensionId: "pstdio.planner" },
  { path: "tickets write", extensionId: "pstdio.planner" },
];

export const hintedExtensionCommandNamespaces = new Set(
  firstPartyCommandHints
    .map((hint) => hint.path.split(" ")[0])
    .filter((namespace): namespace is string => Boolean(namespace)),
);

export const staticCommandPathsInExtensionNamespaces = new Set([
  "workspaces create",
  "workspaces delete",
  "workspaces list",
  "workspaces list-statuses",
  "workspaces merge",
  "workspaces set-status",
]);

export const staticExtensionCommandNamespaces = new Set(
  [...staticCommandPathsInExtensionNamespaces, ...firstPartyCommandHints.map((hint) => hint.path)]
    .map((path) => path.split(" ")[0])
    .filter((namespace): namespace is string => Boolean(namespace)),
);

export const findExtensionCommandHint = (path: string) =>
  firstPartyCommandHints.find((hint) => hint.path === path) ?? null;

export const formatMissingExtensionCommandMessage = (input: { hint: ExtensionCommandHint; disabled?: boolean }) => {
  const lines = [
    `Command "${input.hint.path}" is unavailable because no enabled extension provides it.`,
    `It is normally provided by "${input.hint.extensionId}".`,
  ];

  if (input.disabled) {
    lines.push(`Extension "${input.hint.extensionId}" is disabled for this project.`);
  }

  lines.push(`Enable or install "${input.hint.extensionId}", then run \`pstdio extensions check\` for diagnostics.`);

  return lines.join("\n");
};
