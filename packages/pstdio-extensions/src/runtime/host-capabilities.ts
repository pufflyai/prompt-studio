import type { ExtensionDiagnostic, ExtensionHostCapabilities, ExtensionHostCompatibility } from "pstdio-api-contracts";
import type { ExtensionRuntime } from "../types/runtime";

type CapabilityMap = ExtensionHostCapabilities["capabilities"];

export const dashboardExtensionHostCapabilities = {
  host: "dashboard",
  hostVersion: "0.25.2",
  capabilities: {
    "command.v1": { version: 1, since: "0.1.0" },
    "menu.v1": { version: 1, since: "0.1.0" },
    "command-palette.v1": { version: 1, since: "0.1.0" },
    "mode.v1": { version: 1, since: "0.25.0" },
    "panel.webview.v1": { version: 1, since: "0.1.0" },
    "panel.tree-renderer.v1": { version: 1, since: "0.23.0" },
    "panel.file-renderer.v1": { version: 1, since: "0.23.0" },
    "panel.controls-renderer.v1": { version: 1, since: "0.24.0" },
    "panel.data-table-renderer.v1": { version: 1, since: "0.25.2" },
    "route.webview.v1": { version: 1, since: "0.1.0" },
    "tree-item.v1": { version: 1, since: "0.23.0" },
    "settings.section.v1": { version: 1, since: "0.25.2" },
    "settings.panel.webview.v1": { version: 1, since: "0.1.0" },
    "settings.definition.v1": { version: 1, since: "0.24.0" },
    "renderer.kanban.v1": { version: 1, since: "0.23.0" },
    "renderer.data-table.v1": { version: 1, since: "0.25.2" },
    "renderer.command-palette-resource.v1": { version: 1, since: "0.25.0" },
    "renderer.tree.v1": { version: 1, since: "0.23.0" },
    "renderer.file.v1": { version: 1, since: "0.23.0" },
    "renderer.controls.v1": { version: 1, since: "0.24.0" },
    "keybinding.v1": { version: 1, since: "0.24.0" },
    "resource-hierarchy.v1": { version: 1, since: "0.23.0" },
    "resource-view.v1": { version: 1, since: "0.23.0" },
  },
} satisfies ExtensionHostCapabilities;

const dashboardCapabilities: CapabilityMap = dashboardExtensionHostCapabilities.capabilities;

type CapabilityRequirement = {
  capability: string;
  contributionId: string;
  extensionId: string;
  sourcePath?: string;
  surface: string;
};

const panelBodyRequirements = (panel: ExtensionRuntime["panels"][number]) => {
  const requirements: CapabilityRequirement[] = [];
  const addBody = (
    contributionId: string,
    body: {
      webview?: unknown;
      treeRenderer?: unknown;
      fileRenderer?: unknown;
      controlsRenderer?: unknown;
      dataTableRenderer?: unknown;
    },
  ) => {
    if (body.webview) requirements.push(requirement(panel, contributionId, "panel", "panel.webview.v1"));
    if (body.treeRenderer) requirements.push(requirement(panel, contributionId, "panel", "panel.tree-renderer.v1"));
    if (body.fileRenderer) requirements.push(requirement(panel, contributionId, "panel", "panel.file-renderer.v1"));
    if (body.controlsRenderer)
      requirements.push(requirement(panel, contributionId, "panel", "panel.controls-renderer.v1"));
    if (body.dataTableRenderer) {
      requirements.push(requirement(panel, contributionId, "panel", "panel.data-table-renderer.v1"));
    }
  };

  addBody(panel.id, panel.contribution);
  for (const [localId, menu] of Object.entries(panel.contribution.panelMenus ?? {})) {
    addBody(`${panel.id}.${localId}`, menu);
  }
  return requirements;
};

const requirement = (
  record: { id: string; extensionId: string; sourcePath?: string },
  contributionId: string,
  surface: string,
  capability: string,
): CapabilityRequirement => ({
  capability,
  contributionId,
  extensionId: record.extensionId,
  sourcePath: record.sourcePath,
  surface,
});

const runtimeRequirements = (runtime: ExtensionRuntime) => [
  ...runtime.commands.map((record) => requirement(record, record.id, "command", "command.v1")),
  ...runtime.commands.flatMap((record) => record.menus.map(() => requirement(record, record.id, "menu", "menu.v1"))),
  ...runtime.commands.flatMap((record) =>
    record.palette.map(() => requirement(record, record.id, "commandPalette", "command-palette.v1")),
  ),
  ...runtime.modes.map((record) => requirement(record, record.id, "mode", "mode.v1")),
  ...runtime.panels.flatMap(panelBodyRequirements),
  ...runtime.routes.map((record) => requirement(record, record.id, "route", "route.webview.v1")),
  ...runtime.treeItems.map((record) => requirement(record, record.id, "treeItem", "tree-item.v1")),
  ...runtime.settingsSections.map((record) => requirement(record, record.id, "settingsSection", "settings.section.v1")),
  ...runtime.settingsPanels.map((record) =>
    requirement(record, record.id, "settingsPanel", "settings.panel.webview.v1"),
  ),
  ...runtime.settings.map((record) => requirement(record, record.id, "setting", "settings.definition.v1")),
  ...runtime.kanbanRenderers.map((record) => requirement(record, record.id, "kanbanRenderer", "renderer.kanban.v1")),
  ...runtime.kanbanRenderers
    .filter((record) => record.contribution.resourceKind)
    .map((record) => requirement(record, record.id, "kanbanRenderer", "resource-hierarchy.v1")),
  ...runtime.dataTableRenderers.map((record) =>
    requirement(record, record.id, "dataTableRenderer", "renderer.data-table.v1"),
  ),
  ...runtime.commandPaletteResources.map((record) =>
    requirement(record, record.id, "commandPaletteResource", "renderer.command-palette-resource.v1"),
  ),
  ...runtime.treeRenderers.map((record) => requirement(record, record.id, "treeRenderer", "renderer.tree.v1")),
  ...runtime.fileRenderers.map((record) => requirement(record, record.id, "fileRenderer", "renderer.file.v1")),
  ...runtime.controlsRenderers.map((record) =>
    requirement(record, record.id, "controlsRenderer", "renderer.controls.v1"),
  ),
  ...runtime.keybindings.map((record) => requirement(record, record.id, "keybinding", "keybinding.v1")),
  ...runtime.panels
    .filter((record) => record.contribution.resourceKind)
    .map((record) => requirement(record, record.id, "resourceView", "resource-view.v1")),
];

const missingCapabilityDiagnostic = (
  hostCapabilities: ExtensionHostCapabilities,
  requirement: CapabilityRequirement,
): ExtensionDiagnostic => ({
  code: "extension_host_capability_missing",
  severity: "error",
  extensionId: requirement.extensionId,
  sourcePath: requirement.sourcePath,
  message: `Contribution "${requirement.contributionId}" requires dashboard capability "${requirement.capability}", but ${hostCapabilities.host} ${hostCapabilities.hostVersion} does not advertise it`,
  metadata: {
    host: hostCapabilities.host,
    hostVersion: hostCapabilities.hostVersion,
    contributionId: requirement.contributionId,
    surface: requirement.surface,
    missingCapability: requirement.capability,
    requiredSince: dashboardCapabilities[requirement.capability]?.since,
  },
});

export const checkExtensionHostCompatibility = (
  runtime: ExtensionRuntime,
  hostCapabilities?: ExtensionHostCapabilities | null,
): ExtensionHostCompatibility => {
  if (!hostCapabilities) {
    return {
      status: "unverified",
      diagnostics: [
        {
          code: "extension_host_capability_check_unverified",
          severity: "warning",
          message: "Host compatibility was not verified because no dashboard capability descriptor was available",
        },
      ],
    };
  }

  const diagnostics = runtimeRequirements(runtime)
    .filter((requirement) => !hostCapabilities.capabilities[requirement.capability])
    .map((requirement) => missingCapabilityDiagnostic(hostCapabilities, requirement));

  return { status: "verified", host: hostCapabilities, diagnostics };
};
