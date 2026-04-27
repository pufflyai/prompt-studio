export type ExtensionCommandHint = {
  path: string;
  extensionId: string;
};

const firstPartyCommandHints: ExtensionCommandHint[] = [
  { path: "tickets pull", extensionId: "pstdio.tickets" },
  { path: "tickets push", extensionId: "pstdio.tickets" },
];

export const hintedExtensionCommandNamespaces = new Set(
  firstPartyCommandHints
    .map((hint) => hint.path.split(" ")[0])
    .filter((namespace): namespace is string => Boolean(namespace)),
);

export const staticCommandPathsInExtensionNamespaces = new Set([
  "tickets archive",
  "tickets create",
  "tickets delete",
  "tickets files",
  "tickets implement",
  "tickets list",
  "tickets pull",
  "tickets save",
  "tickets update",
  "tickets update-when-attempt-status",
  "tickets view",
  "tickets workspaces",
  "tickets worktrees",
  "tickets worktrees list",
  "tickets worktrees remove-all",
  "tickets write",
  "workspaces create",
  "workspaces delete",
  "workspaces list",
  "workspaces list-statuses",
  "workspaces merge",
  "workspaces set-status",
]);

export const staticExtensionCommandNamespaces = new Set(
  [...staticCommandPathsInExtensionNamespaces]
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
