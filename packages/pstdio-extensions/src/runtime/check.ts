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
      ...(extensionsRootExists ? [{ path: extensionsRoot, sourceKind: "local" as const }] : []),
    ],
    extensionFiles: input.extensionFiles,
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

const formatExtensionSection = (ext: NormalizedExtension, runtime: ExtensionRuntime): string[] => {
  const out: string[] = [];
  out.push(ext.displayName);
  out.push(`  id:        ${ext.id}`);
  out.push(`  namespace: ${ext.namespace}`);
  if (ext.version) out.push(`  version:   ${ext.version}`);
  out.push(`  source:    ${presentPath(ext.sourcePath)}`);

  const commands = runtime.commands.filter((cmd) => cmd.extensionId === ext.id);
  if (commands.length > 0) {
    out.push("");
    out.push("  Commands");
    for (const cmd of commands) {
      out.push(`    ${cmd.id}`);
      if (cmd.cli) out.push(`      CLI: pstdio ${cmd.cli.pathKey}`);
    }
  }

  const middlewares = runtime.middlewares.filter((m) => m.extensionId === ext.id);
  if (middlewares.length > 0) {
    out.push("");
    out.push("  Middlewares");
    for (const m of middlewares) {
      out.push(`    ${ext.id}.${m.localId}`);
      out.push(`      command: ${m.commandId}`);
    }
  }

  const hooks = runtime.hooks.filter((h) => h.extensionId === ext.id);
  if (hooks.length > 0) {
    out.push("");
    out.push("  Hooks");
    for (const h of hooks) {
      out.push(`    ${ext.id}.${h.localId}`);
      out.push(`      event: ${h.eventId}`);
    }
  }

  const schedules = runtime.schedules.filter((s) => s.extensionId === ext.id);
  if (schedules.length > 0) {
    out.push("");
    out.push("  Schedules");
    for (const s of schedules) {
      out.push(`    ${ext.id}.${s.localId}`);
      out.push(`      command: ${s.commandId}`);
    }
  }

  const mounts = runtime.artifactMounts.filter((m) => m.extensionId === ext.id);
  if (mounts.length > 0) {
    out.push("");
    out.push("  Artifact mounts");
    for (const m of mounts) {
      out.push(`    ${m.localId} -> ${m.fullPath}`);
    }
  }

  const views = runtime.views.filter((v) => v.extensionId === ext.id);
  if (views.length > 0) {
    out.push("");
    out.push("  Views");
    for (const v of views) out.push(`    ${v.id}`);
  }

  const routes = runtime.routes.filter((r) => r.extensionId === ext.id);
  if (routes.length > 0) {
    out.push("");
    out.push("  Routes");
    for (const r of routes) out.push(`    ${r.id} -> ${r.contribution.path}`);
  }

  const navigation = runtime.navigation.filter((n) => n.extensionId === ext.id);
  if (navigation.length > 0) {
    out.push("");
    out.push("  Navigation");
    for (const n of navigation) out.push(`    ${n.id} ${n.contribution.label}`);
  }

  const templates = runtime.templates.filter((t) => t.extensionId === ext.id);
  if (templates.length > 0) {
    out.push("");
    out.push("  Templates");
    for (const t of templates) out.push(`    ${t.id}`);
  }

  const skills = runtime.skills.filter((s) => s.extensionId === ext.id);
  if (skills.length > 0) {
    out.push("");
    out.push("  Skills");
    for (const s of skills) out.push(`    ${s.id}`);
  }

  return out;
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
