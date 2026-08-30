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
    "view.webview.v1": { version: 1, since: "0.26.0" },
    "view.tree.v1": { version: 1, since: "0.26.0" },
    "view.file.v1": { version: 1, since: "0.26.0" },
    "view.controls.v1": { version: 1, since: "0.26.0" },
    "view.kanban.v1": { version: 1, since: "0.26.0" },
    "view.data-table.v1": { version: 1, since: "0.26.0" },
    "placement.v1": { version: 1, since: "0.26.0" },
    "navigation-item.v1": { version: 1, since: "0.26.0" },
    "status-bar-item.v1": { version: 1, since: "0.26.0" },
    "status.v1": { version: 1, since: "0.26.0" },
    "settings.section.v1": { version: 1, since: "0.25.2" },
    "settings.panel.v1": { version: 1, since: "0.26.0" },
    "settings.definition.v1": { version: 1, since: "0.24.0" },
    "renderer.command-palette-resource.v1": { version: 1, since: "0.25.0" },
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
  ...runtime.pages.map((record) => requirement(record, record.id, "page", "page.v1")),
  ...runtime.views.map((record) =>
    requirement(
      record,
      record.id,
      "view",
      `view.${record.contribution.body.kind === "dataTable" ? "data-table" : record.contribution.body.kind}.v1`,
    ),
  ),
  ...runtime.placements.map((record) => requirement(record, record.id, "placement", "placement.v1")),
  ...runtime.navigationItems.map((record) => requirement(record, record.id, "navigationItem", "navigation-item.v1")),
  ...runtime.statusBarItems.map((record) => requirement(record, record.id, "statusBarItem", "status-bar-item.v1")),
  ...runtime.statuses.map((record) => requirement(record, record.id, "status", "status.v1")),
  ...runtime.settingsSections.map((record) => requirement(record, record.id, "settingsSection", "settings.section.v1")),
  ...runtime.settingsPanels.map((record) => requirement(record, record.id, "settingsPanel", "settings.panel.v1")),
  ...runtime.settings.map((record) => requirement(record, record.id, "setting", "settings.definition.v1")),
  ...runtime.commandPaletteResources.map((record) =>
    requirement(record, record.id, "commandPaletteResource", "renderer.command-palette-resource.v1"),
  ),
  ...runtime.keybindings.map((record) => requirement(record, record.id, "keybinding", "keybinding.v1")),
  ...runtime.resourceViews.map((record) => requirement(record, record.id, "resourceView", "resource-view.v1")),
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
