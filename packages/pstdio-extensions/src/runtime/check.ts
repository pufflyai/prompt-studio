import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionRuntime, NormalizedExtension } from "../types/runtime";
import { pstdioExtensionsRoot, pstdioHomeRoot } from "./discovery";
import { type LoadExtensionRuntimeInput, loadExtensionRuntime } from "./runtime";

export type CheckExtensionsInput = LoadExtensionRuntimeInput & {
  /** Override the user root used for default discovery; defaults to ~/.pstdio. */
  homeRoot?: string;
  /** Override the extensions root; defaults to <homeRoot>/extensions. */
  extensionsRoot?: string;
};

export type CheckExtensionsResult = {
  homeRoot: string;
  extensionsRoot: string;
  extensionsRootExists: boolean;
  installedExtensionDirs: string[];
  runtime: ExtensionRuntime;
  errorCount: number;
  warningCount: number;
};

const listInstalledDirs = (root: string) => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

export const checkExtensions = async (input: CheckExtensionsInput = {}): Promise<CheckExtensionsResult> => {
  const homeRoot = input.homeRoot ?? pstdioHomeRoot();
  const extensionsRoot =
    input.extensionsRoot ?? (input.homeRoot ? join(input.homeRoot, "extensions") : pstdioExtensionsRoot());
  const extensionsRootExists = existsSync(extensionsRoot);

  const runtime = await loadExtensionRuntime({
    includeUserRoot: false,
    extensionRoots: [
      ...(input.extensionRoots ?? []),
      ...(extensionsRootExists ? [{ path: extensionsRoot, sourceKind: "local_path" as const }] : []),
    ],
    extensionPackages: input.extensionPackages,
  });

  const errorCount = runtime.diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = runtime.diagnostics.filter((d) => d.severity === "warning").length;

  return {
    homeRoot,
    extensionsRoot,
    extensionsRootExists,
    installedExtensionDirs: listInstalledDirs(extensionsRoot),
    runtime,
    errorCount,
    warningCount,
  };
};

const homePrefix = () => homedir();

const presentPath = (path: string) => {
  const home = homePrefix();
  if (home && path.startsWith(home)) return `~${path.slice(home.length)}`;
  return path;
};

const indent = (lines: string[], prefix: string) => lines.map((line) => `${prefix}${line}`);

type SubsectionRenderer<T> = {
  title: string;
  items: T[];
  renderItem: (item: T) => string[];
};

const renderSubsection = <T>({ title, items, renderItem }: SubsectionRenderer<T>): string[] => {
  if (items.length === 0) return [];
  const lines = ["", `  ${title}`];
  for (const item of items) lines.push(...renderItem(item));
  return lines;
};

const formatExtensionSection = (ext: NormalizedExtension, runtime: ExtensionRuntime): string[] => {
  const header: string[] = [ext.displayName, `  id:        ${ext.id}`, `  name:      ${ext.name}`];
  if (ext.version) header.push(`  version:   ${ext.version}`);
  header.push(`  source:    ${presentPath(ext.sourcePath)}`);

  const subsections: string[] = [
    ...renderSubsection({
      title: "Commands",
      items: runtime.commands.filter((cmd) => cmd.extensionId === ext.id),
      renderItem: (cmd) => {
        const out = [`    ${cmd.id}`];
        if (cmd.cli) out.push(`      CLI: pstdio ${cmd.cli.pathKey}`);
        return out;
      },
    }),
    ...renderSubsection({
      title: "Middlewares",
      items: runtime.middlewares.filter((m) => m.extensionId === ext.id),
      renderItem: (m) => [`    ${ext.id}.${m.localId}`, `      command: ${m.commandId}`],
    }),
    ...renderSubsection({
      title: "Hooks",
      items: runtime.hooks.filter((h) => h.extensionId === ext.id),
      renderItem: (h) => [`    ${ext.id}.${h.localId}`, `      event: ${h.eventId}`],
    }),
    ...renderSubsection({
      title: "Schedules",
      items: runtime.schedules.filter((s) => s.extensionId === ext.id),
      renderItem: (s) => [`    ${ext.id}.${s.localId}`, `      command: ${s.commandId}`],
    }),
    ...renderSubsection({
      title: "Artifact mounts",
      items: runtime.artifactMounts.filter((m) => m.extensionId === ext.id),
      renderItem: (m) => [`    ${m.localId} -> ${m.fullPath}`],
    }),
    ...renderSubsection({
      title: "Views",
      items: runtime.views.filter((v) => v.extensionId === ext.id),
      renderItem: (v) => [`    ${v.id}`],
    }),
    ...renderSubsection({
      title: "Routes",
      items: runtime.routes.filter((r) => r.extensionId === ext.id),
      renderItem: (r) => [`    ${r.id} -> ${r.contribution.path}`],
    }),
    ...renderSubsection({
      title: "Keybindings",
      items: runtime.keybindings.filter((k) => k.extensionId === ext.id),
      renderItem: (k) => [`    ${k.id} (${k.canonicalChord}) -> ${k.commandId}`],
    }),
    ...renderSubsection({
      title: "Templates",
      items: runtime.templates.filter((t) => t.extensionId === ext.id),
      renderItem: (t) => [`    ${t.id}`],
    }),
    ...renderSubsection({
      title: "Skills",
      items: runtime.skills.filter((s) => s.extensionId === ext.id),
      renderItem: (s) => [`    ${s.id}`],
    }),
    ...renderSubsection({
      title: "Themes",
      items: runtime.themes.filter((t) => t.extensionId === ext.id),
      renderItem: (t) => [`    ${t.id} (${t.format}, ${t.mode})`],
    }),
    ...renderSubsection({
      title: "File icon themes",
      items: runtime.fileIconThemes.filter((t) => t.extensionId === ext.id),
      renderItem: (t) => [`    ${t.id} (${t.format})`],
    }),
  ];

  return [...header, ...subsections];
};

export const formatCheckReport = (result: CheckExtensionsResult): string => {
  const { runtime, extensionsRoot, extensionsRootExists, errorCount, warningCount } = result;
  const lines: string[] = [];

  lines.push("Extensions check");
  lines.push("");
  lines.push(`Installed extensions: ${runtime.extensions.length}`);
  lines.push(`Errors: ${errorCount}`);
  lines.push(`Warnings: ${warningCount}`);

  if (!extensionsRootExists || runtime.extensions.length === 0) {
    lines.push("");
    lines.push(`No extensions found in ${presentPath(extensionsRoot)}.`);
  }

  for (const ext of runtime.extensions) {
    lines.push("");
    lines.push(...formatExtensionSection(ext, runtime));
  }

  if (runtime.diagnostics.length > 0) {
    lines.push("");
    lines.push("Diagnostics");
    for (const diag of runtime.diagnostics) {
      lines.push("");
      lines.push(`${diag.severity} ${diag.code}`);
      lines.push(...indent([diag.message], "  "));
      if (diag.extensionId) lines.push(...indent([`extension: ${diag.extensionId}`], "  "));
      if (diag.commandId) lines.push(...indent([`command: ${diag.commandId}`], "  "));
      if (diag.sourcePath) {
        lines.push(...indent(["Source:"], "  "));
        lines.push(...indent([presentPath(diag.sourcePath)], "    "));
      }
    }
  }

  return `${lines.join("\n")}\n`;
};
