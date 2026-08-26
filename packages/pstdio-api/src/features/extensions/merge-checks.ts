import type { ExtensionKeybindingRecord, ExtensionsCheckResponse } from "pstdio-api-contracts";
import { keybindingDedupeEntries } from "pstdio-extensions";
import { addDiagnostic } from "./extension-diagnostics";
import { reservedDashboardModeIds } from "./extension-mode-identity";

const findDuplicateKeybinding = (existing: ExtensionKeybindingRecord[], binding: ExtensionKeybindingRecord) => {
  const existingByKey = new Map(
    existing.flatMap((candidate) =>
      keybindingDedupeEntries({
        key: candidate.key,
        ...candidate.platformOverrides,
        when: candidate.when as never,
      }).map((entry) => [entry.key, { binding: candidate, entry }] as const),
    ),
  );

  for (const entry of keybindingDedupeEntries({
    key: binding.key,
    ...binding.platformOverrides,
    when: binding.when as never,
  })) {
    const match = existingByKey.get(entry.key);
    if (match) return { existing: match.binding, ...entry };
  }
  return undefined;
};

const mergeThemes = (target: ExtensionsCheckResponse, source: ExtensionsCheckResponse) => {
  for (const theme of source.themes) {
    if (target.themes.some((candidate) => candidate.id === theme.id)) {
      addDiagnostic(target, {
        code: "duplicate_theme_id",
        extensionId: theme.extensionId,
        message: `Theme "${theme.id}" is declared by more than one extension`,
        severity: "error",
      });
      continue;
    }
    target.themes.push(theme);
  }
};

const mergeFileIconThemes = (target: ExtensionsCheckResponse, source: ExtensionsCheckResponse) => {
  for (const theme of source.fileIconThemes) {
    if (target.fileIconThemes.some((candidate) => candidate.id === theme.id)) {
      addDiagnostic(target, {
        code: "duplicate_file_icon_theme_id",
        extensionId: theme.extensionId,
        message: `File icon theme "${theme.id}" is declared by more than one extension`,
        severity: "error",
      });
      continue;
    }
    target.fileIconThemes.push(theme);
  }
};

const mergeModes = (target: ExtensionsCheckResponse, source: ExtensionsCheckResponse) => {
  for (const mode of source.modes) {
    if (reservedDashboardModeIds.has(mode.id) || target.modes.some((candidate) => candidate.id === mode.id)) {
      addDiagnostic(target, {
        code: "extension_mode_duplicate",
        extensionId: mode.extensionId,
        message: `Extension "${mode.extensionId}" declares duplicate workbench mode "${mode.id}"`,
        severity: "error",
        metadata: { modeId: mode.id },
      });
      continue;
    }
    target.modes.push(mode);
  }
};

const mergeKeybindings = (target: ExtensionsCheckResponse, source: ExtensionsCheckResponse) => {
  for (const binding of source.keybindings ?? []) {
    const duplicate = findDuplicateKeybinding(target.keybindings ?? [], binding);
    if (duplicate) {
      addDiagnostic(target, {
        code: "duplicate_keybinding_chord",
        extensionId: binding.extensionId,
        commandId: binding.commandId,
        message: `Keybinding "${binding.id}" duplicates "${duplicate.existing.id}" on ${duplicate.platform} (canonical chord "${duplicate.canonicalChord}")`,
        severity: "warning",
        metadata: {
          contributionId: binding.id,
          canonicalChord: duplicate.canonicalChord,
          platform: duplicate.platform,
          existingId: duplicate.existing.id,
          existingExtensionId: duplicate.existing.extensionId,
        },
      });
      continue;
    }
    target.keybindings?.push(binding);
  }
};

export const mergeCheck = (target: ExtensionsCheckResponse, source: ExtensionsCheckResponse) => {
  target.errorCount += source.errorCount;
  target.warningCount += source.warningCount;
  target.extensions.push(...source.extensions);
  target.commands.push(...source.commands);
  target.middlewares.push(...source.middlewares);
  target.hooks.push(...source.hooks);
  target.schedules.push(...source.schedules);
  target.artifactMounts.push(...source.artifactMounts);
  mergeThemes(target, source);
  mergeFileIconThemes(target, source);
  target.menuContributions.push(...source.menuContributions);
  target.commandPaletteContributions?.push(...(source.commandPaletteContributions ?? []));
  mergeModes(target, source);
  target.views.push(...source.views);
  target.viewMenus.push(...source.viewMenus);
  target.placements.push(...source.placements);
  target.resourceKinds.push(...source.resourceKinds);
  target.resourceViews.push(...source.resourceViews);
  target.resourceHierarchyProviders?.push(...(source.resourceHierarchyProviders ?? []));
  target.navigationItems.push(...source.navigationItems);
  target.statusBarItems.push(...source.statusBarItems);
  target.statuses.push(...source.statuses);
  target.activityItems?.push(...(source.activityItems ?? []));
  target.settingsSections?.push(...(source.settingsSections ?? []));
  target.settingsPanels.push(...source.settingsPanels);
  target.commandPaletteResources?.push(...(source.commandPaletteResources ?? []));
  mergeKeybindings(target, source);
  target.settingsDefinitions?.push(...(source.settingsDefinitions ?? []));
  target.templates.push(...source.templates);
  target.skills.push(...source.skills);
  target.diagnostics.push(...source.diagnostics);
  target.hostCompatibility = {
    ...source.hostCompatibility,
    diagnostics: [...target.hostCompatibility.diagnostics, ...source.hostCompatibility.diagnostics],
  };
};
