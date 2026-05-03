import type { ExtensionDiagnostic, ExtensionRuntime, RuntimeCliContribution } from "pstdio-extensions";

const presentSourcePath = (sourcePath: string | undefined) => sourcePath ?? "(unknown)";

export type CliPathCollision = {
  pathKey: string;
  providers: Array<{
    extensionId: string;
    commandId: string;
    sourcePath?: string;
  }>;
};

const renderProviderLine = (provider: CliPathCollision["providers"][number]): string[] => {
  return [`    ${provider.extensionId} ${provider.commandId}`, `      ${presentSourcePath(provider.sourcePath)}`];
};

export const formatCliPathCollision = (collision: CliPathCollision): string => {
  const lines: string[] = [];
  lines.push("error duplicate_cli_path");
  lines.push(`  Duplicate CLI path: pstdio ${collision.pathKey}`);
  lines.push("");
  lines.push("  Providers:");
  for (const provider of collision.providers) {
    lines.push(...renderProviderLine(provider));
  }
  return `${lines.join("\n")}\n`;
};

export type StaticCollision = {
  pathKey: string;
  staticName: string;
  extension: {
    extensionId: string;
    commandId: string;
    sourcePath?: string;
  };
};

export const formatStaticCollision = (collision: StaticCollision): string => {
  const lines: string[] = [];
  lines.push("error cli_path_collision");
  lines.push(`  Extension CLI path collides with a built-in command: pstdio ${collision.pathKey}`);
  lines.push("");
  lines.push("  Extension:");
  lines.push(`    ${collision.extension.extensionId} ${collision.extension.commandId}`);
  lines.push(`      ${presentSourcePath(collision.extension.sourcePath)}`);
  lines.push("");
  lines.push("  Built-in:");
  lines.push(`    ${collision.staticName}`);
  return `${lines.join("\n")}\n`;
};

const sourceLookup = (runtime: Pick<ExtensionRuntime, "commands">, commandId: string) =>
  runtime.commands.find((cmd) => cmd.id === commandId)?.sourcePath;

const collectDuplicateCliPaths = (
  runtime: Pick<ExtensionRuntime, "commands" | "diagnostics" | "cli">,
): CliPathCollision[] => {
  const collisions = new Map<string, CliPathCollision>();

  // Diagnostics from normalize hold the second offender that was dropped.
  const duplicates = runtime.diagnostics.filter((d): d is ExtensionDiagnostic => d.code === "duplicate_cli_path");

  for (const diag of duplicates) {
    if (!diag.commandId) continue;

    // The dropped second offender is identified by commandId in the diagnostic; the kept first
    // offender is found in `runtime.cli` because normalize only adds it once.
    const dropped = {
      extensionId: diag.extensionId ?? "(unknown)",
      commandId: diag.commandId,
      sourcePath: diag.sourcePath ?? sourceLookup(runtime, diag.commandId),
    };

    // Find which kept contribution owns the duplicated path.
    // Diagnostics include path key as part of the message: "CLI path "<key>" is already provided by <id>".
    const match = diag.message.match(/CLI path "([^"]+)"/);
    const pathKey = match?.[1] ?? "";
    if (!pathKey) continue;

    const kept = runtime.cli.find((c) => c.pathKey === pathKey);
    const collision = collisions.get(pathKey) ?? {
      pathKey,
      providers: kept
        ? [
            {
              extensionId: kept.extensionId,
              commandId: kept.commandId,
              sourcePath: sourceLookup(runtime, kept.commandId),
            },
          ]
        : [],
    };

    collision.providers.push(dropped);
    collisions.set(pathKey, collision);
  }

  return Array.from(collisions.values());
};

export type CliCollisionsReport = {
  duplicateCliPaths: CliPathCollision[];
  staticCollisions: StaticCollision[];
  /** Path keys whose execution should be refused. */
  refusedPathKeys: Set<string>;
  /** Namespaces that must be excluded from the extension CLI tree because they collide with static commands. */
  blockedNamespaces: Set<string>;
};

const detectStaticCollisions = (cli: RuntimeCliContribution[], staticNames: Set<string>): StaticCollision[] => {
  const collisions: StaticCollision[] = [];
  const seen = new Set<string>();

  for (const contribution of cli) {
    if (!staticNames.has(contribution.namespace)) continue;
    if (seen.has(contribution.pathKey)) continue;
    seen.add(contribution.pathKey);
    collisions.push({
      pathKey: contribution.pathKey,
      staticName: contribution.namespace,
      extension: {
        extensionId: contribution.extensionId,
        commandId: contribution.commandId,
        sourcePath: undefined,
      },
    });
  }
  return collisions;
};

export const buildCliCollisionsReport = (
  runtime: Pick<ExtensionRuntime, "commands" | "diagnostics" | "cli">,
  staticNames: Set<string>,
): CliCollisionsReport => {
  const duplicateCliPaths = collectDuplicateCliPaths(runtime);
  const staticCollisions = detectStaticCollisions(runtime.cli, staticNames);

  // Attach source paths for static collisions.
  for (const collision of staticCollisions) {
    collision.extension.sourcePath = sourceLookup(runtime, collision.extension.commandId);
  }

  const refusedPathKeys = new Set<string>();
  for (const c of duplicateCliPaths) refusedPathKeys.add(c.pathKey);
  for (const c of staticCollisions) refusedPathKeys.add(c.pathKey);

  const blockedNamespaces = new Set<string>();
  for (const c of staticCollisions) blockedNamespaces.add(c.staticName);

  return { duplicateCliPaths, staticCollisions, refusedPathKeys, blockedNamespaces };
};

export const formatCollisionsReport = (report: CliCollisionsReport): string => {
  const parts: string[] = [];
  for (const c of report.duplicateCliPaths) parts.push(formatCliPathCollision(c));
  for (const c of report.staticCollisions) parts.push(formatStaticCollision(c));
  return parts.join("\n");
};
