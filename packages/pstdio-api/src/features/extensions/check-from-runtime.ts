import type { ExtensionFileIconThemeRecord, ExtensionThemeRecord } from "pstdio-api-contracts";
import type { ExtensionRuntime } from "pstdio-extensions";

const localizedString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "$l10n" in value) {
    const localized = value as { $l10n: string; default?: string };
    return typeof localized.default === "string" ? localized.default : localized.$l10n;
  }
  return undefined;
};

const displayString = (value: unknown, fallback: string) => localizedString(value) ?? fallback;

export const toCheckMiddlewares = (middlewares: ExtensionRuntime["middlewares"]) =>
  middlewares.map((middleware) => ({
    id: middleware.id,
    commandId: middleware.commandId,
    extensionId: middleware.extensionId,
  }));

export const toCheckHooks = (hooks: ExtensionRuntime["hooks"]) =>
  hooks.map((hook) => ({ id: hook.id, eventId: hook.eventId, extensionId: hook.extensionId }));

export const toCheckSchedules = (schedules: ExtensionRuntime["schedules"]) =>
  schedules.map((schedule) => ({
    id: schedule.id,
    commandId: schedule.commandId,
    cron: schedule.cron,
    extensionId: schedule.extensionId,
  }));

export const toCheckArtifactMounts = (artifactMounts: ExtensionRuntime["artifactMounts"]) =>
  artifactMounts.map((mount) => ({
    id: mount.id,
    extensionId: mount.extensionId,
    fullPath: mount.fullPath,
    label: mount.label,
    relativePath: mount.relativePath,
  }));

export const toCheckThemes = (themes: ExtensionRuntime["themes"]): ExtensionThemeRecord[] =>
  themes.map((theme) => {
    const description = localizedString(theme.description);
    return {
      id: theme.id,
      extensionId: theme.extensionId,
      title: displayString(theme.title, theme.localId),
      ...(description ? { description } : {}),
      format: "vscode-color-theme" as const,
      mode: theme.mode,
      source: theme.source as ExtensionThemeRecord["source"],
      tokens: theme.preference.tokens,
      monacoTheme: theme.monacoTheme,
    };
  });

export const toCheckFileIconThemes = (themes: ExtensionRuntime["fileIconThemes"]): ExtensionFileIconThemeRecord[] =>
  themes.map((theme) => {
    const description = localizedString(theme.description);
    return {
      id: theme.id,
      extensionId: theme.extensionId,
      title: displayString(theme.title, theme.localId),
      ...(description ? { description } : {}),
      format: "vscode-file-icon-theme" as const,
      source: theme.source as ExtensionFileIconThemeRecord["source"],
      definitions: theme.definitions,
      fileExtensions: theme.fileExtensions,
      fileNames: theme.fileNames,
      defaults: theme.defaults,
      fonts: theme.fonts,
    };
  });

export const toCheckTemplates = (templates: ExtensionRuntime["templates"]) =>
  templates.map((template) => ({ id: template.id, extensionId: template.extensionId }));

export const toCheckSkills = (skills: ExtensionRuntime["skills"]) =>
  skills.map((skill) => ({ id: skill.id, extensionId: skill.extensionId }));
