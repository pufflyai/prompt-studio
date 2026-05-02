import { homedir } from "node:os";
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";

const presentPath = (path: string) => {
  const home = homedir();
  if (home && path.startsWith(home)) return `~${path.slice(home.length)}`;
  return path;
};

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

const formatExtensionSection = (
  extensionId: string,
  displayName: string,
  namespace: string,
  version: string | undefined,
  sourcePath: string,
  response: ExtensionsCheckResponse,
): string[] => {
  const header: string[] = [displayName, `  id:        ${extensionId}`, `  namespace: ${namespace}`];
  if (version) header.push(`  version:   ${version}`);
  header.push(`  source:    ${presentPath(sourcePath)}`);

  const subsections: string[] = [
    ...renderSubsection({
      title: "Commands",
      items: response.commands.filter((cmd) => cmd.extensionId === extensionId),
      renderItem: (cmd) => {
        const out = [`    ${cmd.id}`];
        if (cmd.cliPath) out.push(`      CLI: pstdio ${cmd.cliPath}`);
        return out;
      },
    }),
    ...renderSubsection({
      title: "Middlewares",
      items: response.middlewares.filter((m) => m.extensionId === extensionId),
      renderItem: (m) => [`    ${m.id}`, `      command: ${m.commandId}`],
    }),
    ...renderSubsection({
      title: "Hooks",
      items: response.hooks.filter((h) => h.extensionId === extensionId),
      renderItem: (h) => [`    ${h.id}`, `      event: ${h.eventId}`],
    }),
    ...renderSubsection({
      title: "Schedules",
      items: response.schedules.filter((s) => s.extensionId === extensionId),
      renderItem: (s) => [`    ${s.id}`, `      command: ${s.commandId}`],
    }),
    ...renderSubsection({
      title: "Artifact mounts",
      items: response.artifactMounts.filter((m) => m.extensionId === extensionId),
      renderItem: (m) => [`    ${m.label} -> ${m.fullPath}`],
    }),
    ...renderSubsection({
      title: "Views",
      items: response.views.filter((v) => v.extensionId === extensionId),
      renderItem: (v) => [`    ${v.id}`],
    }),
    ...renderSubsection({
      title: "Routes",
      items: response.routes.filter((r) => r.extensionId === extensionId),
      renderItem: (r) => [`    ${r.id} -> ${r.path}`],
    }),
    ...renderSubsection({
      title: "Navigation",
      items: response.navigation.filter((n) => n.extensionId === extensionId),
      renderItem: (n) => [`    ${n.id} ${n.label}`],
    }),
    ...renderSubsection({
      title: "Templates",
      items: response.templates.filter((t) => t.extensionId === extensionId),
      renderItem: (t) => [`    ${t.id}`],
    }),
    ...renderSubsection({
      title: "Skills",
      items: response.skills.filter((s) => s.extensionId === extensionId),
      renderItem: (s) => [`    ${s.id}`],
    }),
  ];

  return [...header, ...subsections];
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
