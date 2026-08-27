import type { ContributionKind } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
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
    connections: true,
    defaultLocale: true,
    fileIconThemes: true,
    harnesses: true,
    hooks: true,
    keybindings: true,
    middlewares: true,
    modes: true,
    navigationItems: true,
    placements: true,
    resourceKinds: true,
    resourceViews: true,
    resourceHierarchyProviders: true,
    schedules: true,
    settings: true,
    settingsPanels: true,
    settingsSections: true,
    statusBarItems: true,
    statuses: true,
    skills: true,
    templateTypes: true,
    templates: true,
    themes: true,
    translations: true,
    views: true,
    viewMenus: true,
    workspaceTypes: true,
  }),
);

const removedAlpha4ContributionKeys = new Set([
  "controlsRenderers",
  "dataTableRenderers",
  "fileRenderers",
  "initialSetup",
  "kanbanRenderers",
  "migrate",
  "panels",
  "resourcePanels",
  "routes",
  "statusItems",
  "treeItems",
  "treeRenderers",
]);

const collectionKinds = new Map<string, ContributionKind>([
  ["activityItems", "activity-item"],
  ["artifactMounts", "artifact-mount"],
  ["commandPaletteResources", "command-palette-resource"],
  ["commands", "command"],
  ["connections", "connection"],
  ["fileIconThemes", "file-icon-theme"],
  ["harnesses", "harness"],
  ["hooks", "hook"],
  ["keybindings", "keybinding"],
  ["middlewares", "middleware"],
  ["modes", "mode"],
  ["navigationItems", "navigation-item"],
  ["placements", "placement"],
  ["resourceHierarchyProviders", "resource-hierarchy-provider"],
  ["resourceKinds", "resource-kind"],
  ["resourceViews", "resource-view"],
  ["schedules", "schedule"],
  ["settingsPanels", "settings-panel"],
  ["settingsSections", "settings-section"],
  ["skills", "skill"],
  ["statusBarItems", "status-bar-item"],
  ["statuses", "status"],
  ["templates", "template"],
  ["templateTypes", "template-type"],
  ["themes", "theme"],
  ["viewMenus", "view-menu"],
  ["views", "view"],
  ["workspaceTypes", "workspace-type"],
]);

const aliasesByCollection = new Map<string, readonly string[]>([
  ["hooks", ["eventId", "handler"]],
  ["keybindings", ["args"]],
  ["middlewares", ["commandId", "handler"]],
  ["modes", ["defaultResource", "modePanels", "panelRegions", "resources"]],
  ["schedules", ["commandId", "cron", "repoId", "repoPath"]],
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalidCollectionDiagnostic = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  key: string,
  message: string,
) =>
  createDiagnostic({
    code: "invalid_contribution_collection",
    message,
    extensionId: ext.id,
    sourcePath: source.sourcePath,
    metadata: { key },
  });

const validateContributionRecord = (input: {
  contribution: unknown;
  ext: NormalizedExtension;
  index: number;
  key: string;
  kind: ContributionKind;
  runtime: Accumulator;
  source: LoadedExtensionSource;
}) => {
  const { contribution, ext, index, key, kind, runtime, source } = input;
  if (!isRecord(contribution) || typeof contribution.id !== "string" || contribution.id.trim().length === 0) {
    runtime.diagnostics.push(
      invalidCollectionDiagnostic(
        ext,
        source,
        key,
        `Extension "${ext.id}" ${kind} contribution at index ${index} must define a non-empty local id`,
      ),
    );
    return false;
  }

  let valid = true;
  if (
    !isRecord(contribution.ref) ||
    contribution.ref.kind !== kind ||
    contribution.ref.id !== contribution.id ||
    contribution.ref.extensionId !== undefined
  ) {
    valid = false;
    runtime.diagnostics.push(
      invalidCollectionDiagnostic(
        ext,
        source,
        key,
        `Extension "${ext.id}" ${kind} "${contribution.id}" must contain its local typed ref`,
      ),
    );
  }

  for (const alias of aliasesByCollection.get(key) ?? []) {
    if (!Object.hasOwn(contribution, alias)) continue;
    valid = false;
    runtime.diagnostics.push(
      createDiagnostic({
        code: "removed_extension_contribution_field",
        message: `Extension "${ext.id}" ${kind} "${contribution.id}" uses removed field "${alias}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
        metadata: { key, kind, localId: contribution.id, field: alias },
      }),
    );
  }
  return valid;
};

const validateContributionCollections = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  let valid = true;
  const definition = source.definition as unknown as Record<string, unknown>;
  for (const [key, kind] of collectionKinds) {
    const raw = definition[key];
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) {
      valid = false;
      runtime.diagnostics.push(
        invalidCollectionDiagnostic(ext, source, key, `Extension "${ext.id}" contribution "${key}" must be an array`),
      );
      continue;
    }
    for (const [index, contribution] of raw.entries()) {
      if (!validateContributionRecord({ contribution, ext, index, key, kind, runtime, source })) valid = false;
    }
  }
  return valid;
};

export const validateExtensionDefinition = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  let valid = true;
  for (const key of Object.keys(source.definition).sort()) {
    if (source.manifest.enginesPstdio === EXTENSION_API_VERSION && removedAlpha4ContributionKeys.has(key)) {
      valid = false;
      runtime.diagnostics.push(
        createDiagnostic({
          code: "removed_extension_contribution",
          message: `Extension "${ext.id}" uses removed alpha.3 contribution "${key}"`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { key },
        }),
      );
      continue;
    }
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
  return validateContributionCollections(ext, source, runtime) && valid;
};
