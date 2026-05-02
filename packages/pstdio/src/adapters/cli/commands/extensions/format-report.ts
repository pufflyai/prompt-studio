import { homedir } from "node:os";
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";

const presentPath = (path: string) => {
  const home = homedir();
  if (home && path.startsWith(home)) return `~${path.slice(home.length)}`;
  return path;
};

const formatExtensionSection = (
  extensionId: string,
  displayName: string,
  namespace: string,
  version: string | undefined,
  sourcePath: string,
  response: ExtensionsCheckResponse,
): string[] => {
  const out: string[] = [];
  out.push(displayName);
  out.push(`  id:        ${extensionId}`);
  out.push(`  namespace: ${namespace}`);
  if (version) out.push(`  version:   ${version}`);
  out.push(`  source:    ${presentPath(sourcePath)}`);

  const commands = response.commands.filter((cmd) => cmd.extensionId === extensionId);
  if (commands.length > 0) {
    out.push("");
    out.push("  Commands");
    for (const cmd of commands) {
      out.push(`    ${cmd.id}`);
      if (cmd.cliPath) out.push(`      CLI: pstdio ${cmd.cliPath}`);
    }
  }

  const middlewares = response.middlewares.filter((m) => m.extensionId === extensionId);
  if (middlewares.length > 0) {
    out.push("");
    out.push("  Middlewares");
    for (const m of middlewares) {
      out.push(`    ${m.id}`);
      out.push(`      command: ${m.commandId}`);
    }
  }

  const hooks = response.hooks.filter((h) => h.extensionId === extensionId);
  if (hooks.length > 0) {
    out.push("");
    out.push("  Hooks");
    for (const h of hooks) {
      out.push(`    ${h.id}`);
      out.push(`      event: ${h.eventId}`);
    }
  }

  const schedules = response.schedules.filter((s) => s.extensionId === extensionId);
  if (schedules.length > 0) {
    out.push("");
    out.push("  Schedules");
    for (const s of schedules) {
      out.push(`    ${s.id}`);
      out.push(`      command: ${s.commandId}`);
    }
  }

  const mounts = response.artifactMounts.filter((m) => m.extensionId === extensionId);
  if (mounts.length > 0) {
    out.push("");
    out.push("  Artifact mounts");
    for (const m of mounts) {
      out.push(`    ${m.label} -> ${m.fullPath}`);
    }
  }

  const views = response.views.filter((v) => v.extensionId === extensionId);
  if (views.length > 0) {
    out.push("");
    out.push("  Views");
    for (const v of views) out.push(`    ${v.id}`);
  }

  const routes = response.routes.filter((r) => r.extensionId === extensionId);
  if (routes.length > 0) {
    out.push("");
    out.push("  Routes");
    for (const r of routes) out.push(`    ${r.id} -> ${r.path}`);
  }

  const navigation = response.navigation.filter((n) => n.extensionId === extensionId);
  if (navigation.length > 0) {
    out.push("");
    out.push("  Navigation");
    for (const n of navigation) out.push(`    ${n.id} ${n.label}`);
  }

  const templates = response.templates.filter((t) => t.extensionId === extensionId);
  if (templates.length > 0) {
    out.push("");
    out.push("  Templates");
    for (const t of templates) out.push(`    ${t.id}`);
  }

  const skills = response.skills.filter((s) => s.extensionId === extensionId);
  if (skills.length > 0) {
    out.push("");
    out.push("  Skills");
    for (const s of skills) out.push(`    ${s.id}`);
  }

  return out;
};

export const formatExtensionsCheckReport = (response: ExtensionsCheckResponse) => {
  const { extensions, extensionsRoot, extensionsRootExists, errorCount, warningCount, diagnostics } = response;
  const lines: string[] = [];

  lines.push("Extensions check");
  lines.push("");
  lines.push(`Installed extensions: ${extensions.length}`);
  lines.push(`Errors: ${errorCount}`);
  lines.push(`Warnings: ${warningCount}`);

  if (!extensionsRootExists || extensions.length === 0) {
    lines.push("");
    lines.push(`No extensions found in ${presentPath(extensionsRoot)}.`);
  }

  for (const ext of extensions) {
    lines.push("");
    lines.push(
      ...formatExtensionSection(ext.id, ext.displayName, ext.namespace, ext.version, ext.sourcePath, response),
    );
  }

  if (diagnostics.length > 0) {
    lines.push("");
    lines.push("Diagnostics");
    for (const diag of diagnostics) {
      lines.push("");
      lines.push(`${diag.severity} ${diag.code}`);
      lines.push(`  ${diag.message}`);
      if (diag.extensionId) lines.push(`  extension: ${diag.extensionId}`);
      if (diag.commandId) lines.push(`  command: ${diag.commandId}`);
      if (diag.sourcePath) {
        lines.push("  Source:");
        lines.push(`    ${presentPath(diag.sourcePath)}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
};
