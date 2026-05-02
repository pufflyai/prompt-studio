import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { CheckExtensionsResult } from "pstdio-extensions";
import type { ExtensionService } from "../../services/extension-service";

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
    views: runtime.views.map((v) => ({ id: v.id, extensionId: v.extensionId })),
    routes: runtime.routes.map((r) => ({
      id: r.id,
      extensionId: r.extensionId,
      path: r.contribution.path,
    })),
    navigation: runtime.navigation.map((n) => ({
      id: n.id,
      extensionId: n.extensionId,
      label: n.contribution.label,
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
