import type { ExtensionRuntime } from "pstdio-extensions";

export type RecoveryHint = {
  /** Path segments under `pstdio` (e.g. ["planner", "tickets", "pull"]). */
  path: string[];
  /** Extension id expected to provide this CLI path. */
  providerId: string;
  /** Optional install hint — what to pass to `pstdio extensions add`. */
  install?: string;
};

const HINTS: RecoveryHint[] = [
  { path: ["planner", "tickets", "pull"], providerId: "pstdio.planner", install: "planner" },
  { path: ["planner", "tickets", "push"], providerId: "pstdio.planner", install: "planner" },
  { path: ["tickets", "pull"], providerId: "pstdio.planner", install: "planner" },
  { path: ["tickets", "push"], providerId: "pstdio.planner", install: "planner" },
  {
    path: ["harness", "claude-code", "detect"],
    providerId: "pstdio.harness.claude-code",
    install: "harness-claude-code",
  },
];

const matchesHint = (tokens: string[], hint: RecoveryHint) => {
  if (hint.path.length === 0 || tokens.length < hint.path.length) return false;
  return hint.path.every((segment, index) => segment === tokens[index]);
};

export const findRecoveryHint = (tokens: string[]): RecoveryHint | undefined => {
  for (const hint of HINTS) {
    if (matchesHint(tokens, hint)) return hint;
  }
  return undefined;
};

export const getRecoveryHints = (): readonly RecoveryHint[] => HINTS;

export type RecoveryStatus = "missing" | "installed-disabled";

export type RecoveryDetails = {
  hint: RecoveryHint;
  invokedPath: string[];
  status: RecoveryStatus;
};

const formatPath = (path: string[]) => `pstdio ${path.join(" ")}`;

export const formatRecoveryMessage = (details: RecoveryDetails): string => {
  const { hint, invokedPath, status } = details;
  const lines: string[] = [];
  lines.push(`Command not found: ${formatPath(invokedPath)}`);
  lines.push("");

  if (status === "installed-disabled") {
    lines.push("This command is provided by:");
    lines.push(`  ${hint.providerId}`);
    lines.push("");
    lines.push("The extension appears to be installed but disabled for this project.");
    lines.push("");
    lines.push("Try:");
    lines.push(`  pstdio extensions enable ${hint.providerId}`);
    lines.push("  pstdio extensions check");
  } else {
    lines.push("This command is normally provided by:");
    lines.push(`  ${hint.providerId}`);
    lines.push("");
    lines.push("Try:");
    if (hint.install) lines.push(`  pstdio extensions add ${hint.install}`);
    lines.push("  pstdio extensions check");
  }

  return `${lines.join("\n")}\n`;
};

export type ExtensionAvailability = {
  installed: boolean;
  /** Reserved for future API-backed enablement; defaults to installed. */
  enabled: boolean;
};

export const checkExtensionAvailability = (
  runtime: Pick<ExtensionRuntime, "extensions">,
  providerId: string,
): ExtensionAvailability => {
  const installed = runtime.extensions.some((ext) => ext.id === providerId);
  return { installed, enabled: installed };
};
