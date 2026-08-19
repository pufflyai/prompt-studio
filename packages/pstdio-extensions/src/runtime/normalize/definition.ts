import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";

const contributionKeys = new Set(
  Object.keys({
    activityItems: true,
    artifactMounts: true,
    commandPaletteResources: true,
    commands: true,
    controlsRenderers: true,
    dataTableRenderers: true,
    defaultLocale: true,
    fileIconThemes: true,
    fileRenderers: true,
    harnesses: true,
    hooks: true,
    initialSetup: true,
    kanbanRenderers: true,
    keybindings: true,
    middlewares: true,
    migrate: true,
    modes: true,
    panels: true,
    resourceKinds: true,
    resourcePanels: true,
    resourceHierarchyProviders: true,
    routes: true,
    schedules: true,
    settings: true,
    settingsPanels: true,
    settingsSections: true,
    statusItems: true,
    skills: true,
    templateTypes: true,
    templates: true,
    themes: true,
    translations: true,
    treeItems: true,
    treeRenderers: true,
    workspaceTypes: true,
  } satisfies Record<keyof ExtensionDefinition, true>),
);

export const validateExtensionDefinition = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  for (const key of Object.keys(source.definition).sort()) {
    if (contributionKeys.has(key)) continue;
    runtime.diagnostics.push(
      createDiagnostic({
        code: "unknown_extension_contribution",
        message: `Extension "${ext.id}" declares unknown contribution "${key}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
        metadata: { key },
      }),
    );
  }
};
