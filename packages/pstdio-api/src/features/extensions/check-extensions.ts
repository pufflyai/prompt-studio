import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { CheckExtensionsResult } from "pstdio-extensions";
import type { ExtensionService } from "../../services/extension-service";

const contributionSlotId = (slot: { id: string } | string) => (typeof slot === "string" ? slot : slot.id);

const contributionCommandId = (command: { id: string } | string | undefined, fallback?: string) => {
  if (!command) return fallback;
  return typeof command === "string" ? command : command.id;
};

const contributionParams = (params: object | undefined) => params as Record<string, unknown> | undefined;

export const buildCheckResponse = (result: CheckExtensionsResult): ExtensionsCheckResponse => {
  const { runtime, extensionsRoot, extensionsRootExists, errorCount, warningCount } = result;

  return {
    extensionsRoot,
    extensionsRootExists,
    errorCount,
    warningCount,
    extensions: runtime.extensions.map((ext) => ({
      id: ext.id,
      namespace: ext.namespace,
      displayName: ext.displayName,
      version: ext.version,
      sourcePath: ext.sourcePath,
    })),
    commands: runtime.commands.map((cmd) => ({
      id: cmd.id,
      extensionId: cmd.extensionId,
      namespace: cmd.namespace,
      title: cmd.title,
      description: cmd.description,
      cliPath: cmd.cli?.pathKey,
    })),
    middlewares: runtime.middlewares.map((m) => ({
      id: m.id,
      extensionId: m.extensionId,
      commandId: m.commandId,
    })),
    hooks: runtime.hooks.map((h) => ({
      id: h.id,
      extensionId: h.extensionId,
      eventId: h.eventId,
    })),
    schedules: runtime.schedules.map((s) => ({
      id: s.id,
      extensionId: s.extensionId,
      cron: s.cron,
      commandId: s.commandId,
    })),
    artifactMounts: runtime.artifactMounts.map((m) => ({
      id: m.id,
      extensionId: m.extensionId,
      namespace: m.namespace,
      relativePath: m.relativePath,
      fullPath: m.fullPath,
      label: m.label,
    })),
    menuContributions: runtime.commands.flatMap((cmd) =>
      cmd.menus.map((menu) => {
        const slotId = contributionSlotId(menu.slot);
        return {
          id: `${cmd.id}:${slotId}`,
          extensionId: cmd.extensionId,
          commandId: contributionCommandId(menu.command, cmd.id) ?? cmd.id,
          slotId,
          label: menu.label ?? cmd.title,
          group: menu.group,
          placement: menu.placement,
          icon: menu.icon,
          presentation: menu.presentation,
          params: contributionParams(menu.params),
        };
      }),
    ),
    views: runtime.views.map((v) => ({
      id: v.id,
      extensionId: v.extensionId,
      slotId: contributionSlotId(v.contribution.slot),
      title: v.contribution.title,
      group: v.contribution.group,
      placement: v.contribution.placement,
      webview: v.contribution.webview,
    })),
    routes: runtime.routes.map((r) => ({
      id: r.id,
      extensionId: r.extensionId,
      path: r.contribution.path,
      label: r.contribution.label,
      webview: r.contribution.webview,
    })),
    navigation: runtime.navigation.map((n) => ({
      id: n.id,
      extensionId: n.extensionId,
      slotId: contributionSlotId(n.contribution.slot),
      label: n.contribution.label,
      group: n.contribution.group,
      placement: n.contribution.placement,
      route: n.contribution.route,
      href: n.contribution.href,
      commandId: contributionCommandId(n.contribution.command),
      params: contributionParams(n.contribution.params),
      icon: n.contribution.icon,
    })),
    settingsPanels: runtime.settingsPanels.map((panel) => ({
      id: panel.id,
      extensionId: panel.extensionId,
      slotId: contributionSlotId(panel.contribution.slot),
      title: panel.contribution.title,
      webview: panel.contribution.webview,
    })),
    templates: runtime.templates.map((t) => ({ id: t.id, extensionId: t.extensionId })),
    skills: runtime.skills.map((s) => ({ id: s.id, extensionId: s.extensionId })),
    diagnostics: runtime.diagnostics.map((d) => ({
      code: d.code,
      severity: d.severity,
      message: d.message,
      extensionId: d.extensionId,
      commandId: d.commandId,
      sourcePath: d.sourcePath,
    })),
  };
};

export const runExtensionsCheck = async (extensionService: ExtensionService): Promise<ExtensionsCheckResponse> => {
  const result = await extensionService.check();
  return buildCheckResponse(result);
};
