import type { ExtensionDiagnostic } from "@pstdio/sdk/extensions";
import { loadExtensionRuntime as defaultLoadExtensionRuntime } from "pstdio-extensions";
import type { Arguments } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";

export const command = "check";
export const describe = "Inspect local extensions and print runtime diagnostics";

const noProjectMessage = "No project specified. Run inside a linked project with .pstdio/config.json.";

type Runtime = Awaited<ReturnType<typeof defaultLoadExtensionRuntime>>;

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  loadExtensionRuntime: typeof defaultLoadExtensionRuntime;
  log: (msg: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  loadExtensionRuntime: defaultLoadExtensionRuntime,
  log: console.log,
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

const resolveProjectRoot = (deps: Pick<Deps, "cwd" | "findGitRoot" | "readConfig">) => {
  const root = deps.findGitRoot(deps.cwd());
  if (!root) throw new Error(noProjectMessage);

  const config = deps.readConfig(root);
  if (!config) throw new Error(noProjectMessage);

  return root;
};

const formatList = (title: string, values: string[], emptyMessage: string) => {
  if (values.length === 0) return `${title}\n  ${emptyMessage}`;
  return [title, ...values.map((value) => `  - ${value}`)].join("\n");
};

const formatRelated = (diagnostic: ExtensionDiagnostic) => {
  if (!diagnostic.related || diagnostic.related.length === 0) return null;

  const lines = diagnostic.related.map((entry) => {
    const details = [
      entry.extensionId ? `extension=${entry.extensionId}` : null,
      entry.commandId ? `command=${entry.commandId}` : null,
      entry.path ? `path=${entry.path}` : null,
      entry.sourcePath ? `source=${entry.sourcePath}` : null,
      entry.label ? `label=${entry.label}` : null,
    ].filter(Boolean);

    return `      - ${details.join(", ")}`;
  });

  return ["    related:", ...lines].join("\n");
};

const formatDiagnostics = (diagnostics: ExtensionDiagnostic[]) => {
  if (diagnostics.length === 0) return "Diagnostics\n  No diagnostics.";

  const lines = diagnostics.flatMap((diagnostic) => {
    const details = [
      diagnostic.extensionId ? `extension=${diagnostic.extensionId}` : null,
      diagnostic.sourcePath ? `source=${diagnostic.sourcePath}` : null,
    ].filter(Boolean);

    const primary = `  - [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`;
    const detailsLine = details.length > 0 ? `    ${details.join(", ")}` : null;
    const related = formatRelated(diagnostic);

    return [primary, detailsLine, related].filter(Boolean);
  });

  return ["Diagnostics", ...lines].join("\n");
};

export const formatExtensionsCheckOutput = (input: { projectRoot: string; runtime: Runtime }) => {
  const { runtime, projectRoot } = input;

  const sections = [
    `Project root: ${projectRoot}`,
    formatList(
      "Loaded extensions",
      runtime.extensions.map((extension) => `${extension.id} (${extension.sourcePath})`),
      "No extensions loaded.",
    ),
    formatList(
      "Registered command ids",
      runtime.commands.map((command) => `${command.id} (${command.sourcePath})`),
      "No command ids registered.",
    ),
    formatList(
      "Registered CLI paths",
      runtime.cli.map((cli) => `${cli.path} (${cli.commandId})`),
      "No CLI paths registered.",
    ),
    formatList(
      "Registered artifact mounts",
      runtime.artifactMounts.map((mount) => `${mount.path} (${mount.id})`),
      "No artifact mounts registered.",
    ),
    formatList(
      "Registered harness providers",
      runtime.harnesses.map((harness) => `${harness.id} (${harness.label})`),
      "No harness providers registered.",
    ),
    formatDiagnostics(runtime.diagnostics),
  ];

  return sections.join("\n\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (_argv: Arguments) => {
    const projectRoot = resolveProjectRoot(deps);
    const runtime = await deps.loadExtensionRuntime({ projectRoot });
    deps.log(formatExtensionsCheckOutput({ projectRoot, runtime }));

    const hasErrorDiagnostics = runtime.diagnostics.some((diagnostic) => diagnostic.severity === "error");
    if (hasErrorDiagnostics) deps.setExitCode(1);
  };

export const handler = createHandler();
