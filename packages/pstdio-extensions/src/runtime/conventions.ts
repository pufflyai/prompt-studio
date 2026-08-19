import type { ExtensionDiagnostic, ExtensionRuntime } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";
import { workbenchIconNames } from "./workbench-icon-names";

// Convention diagnostics for `extensions check`: invalid icon names, inconsistent
// contribution id casing, and dangling command references. They run over the
// normalized runtime so every check sees resolved contribution ids.

const toKebabIconName = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();

const refIdOf = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return undefined;
};

interface ContributionSite {
  id: string;
  localId: string;
  extensionId: string;
  name: string;
  sourcePath: string;
}

const iconSites = (runtime: ExtensionRuntime) => {
  const sites: { record: ContributionSite; icon: unknown; kind: string }[] = [];
  for (const record of runtime.modes) sites.push({ record, icon: record.contribution.icon, kind: "mode" });
  for (const record of runtime.panels) sites.push({ record, icon: record.contribution.icon, kind: "panel" });
  for (const record of runtime.treeItems) sites.push({ record, icon: record.contribution.icon, kind: "treeItem" });
  for (const record of runtime.activityItems) {
    sites.push({ record, icon: record.contribution.icon, kind: "activityItem" });
  }
  for (const record of runtime.commands) {
    for (const menu of record.menus) sites.push({ record, icon: menu.icon, kind: "menu" });
  }
  return sites;
};

const collectIconDiagnostics = (runtime: ExtensionRuntime) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  for (const site of iconSites(runtime)) {
    if (typeof site.icon !== "string" || site.icon.length === 0) continue;
    if (workbenchIconNames.has(toKebabIconName(site.icon))) continue;
    diagnostics.push(
      createDiagnostic({
        code: "extension_icon_unknown",
        severity: "warning",
        message: `${site.kind} "${site.record.id}" uses unknown icon "${site.icon}"; it will render as an empty icon`,
        extensionId: site.record.extensionId,
        sourcePath: site.record.sourcePath,
        metadata: { contributionId: site.record.id, icon: site.icon },
      }),
    );
  }
  return diagnostics;
};

const localIdRecords = (runtime: ExtensionRuntime): ContributionSite[] => [
  ...runtime.commands,
  ...runtime.privateHandlers,
  ...runtime.modes,
  ...runtime.panels,
  ...runtime.treeItems,
  ...runtime.activityItems,
  ...runtime.resourceKinds,
  ...runtime.resourcePanels,
  ...runtime.treeRenderers,
  ...runtime.fileRenderers,
  ...runtime.controlsRenderers,
  ...runtime.dataTableRenderers,
  ...runtime.kanbanRenderers,
];

const isKebab = (localId: string) => localId.includes("-") && localId === localId.toLowerCase();
const isCamel = (localId: string) => /[A-Z]/.test(localId);

const collectIdCasingDiagnostics = (runtime: ExtensionRuntime) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const byExtension = new Map<string, ContributionSite[]>();
  for (const record of localIdRecords(runtime)) {
    byExtension.set(record.extensionId, [...(byExtension.get(record.extensionId) ?? []), record]);
  }

  for (const [extensionId, records] of byExtension) {
    // A dotted local id collides with the namespaced `<extension>.<id>` reference
    // form, so references to it resolve to the wrong extension.
    for (const record of records) {
      if (!record.localId.includes(".")) continue;
      diagnostics.push(
        createDiagnostic({
          code: "extension_contribution_id_casing",
          severity: "warning",
          message: `Contribution id "${record.localId}" contains "."; dots are reserved for cross-extension references`,
          extensionId,
          sourcePath: record.sourcePath,
          metadata: { contributionId: record.id, reason: "dotted-local-id" },
        }),
      );
    }

    const kebab = records.find((record) => isKebab(record.localId));
    const camel = records.find((record) => isCamel(record.localId));
    if (kebab && camel) {
      diagnostics.push(
        createDiagnostic({
          code: "extension_contribution_id_casing",
          severity: "warning",
          message: `Extension mixes contribution id styles: "${kebab.localId}" (kebab-case) and "${camel.localId}" (camelCase); pick one`,
          extensionId,
          sourcePath: kebab.sourcePath,
          metadata: { reason: "mixed-casing", examples: [kebab.localId, camel.localId] },
        }),
      );
    }
  }
  return diagnostics;
};

const commandReferenceSites = (runtime: ExtensionRuntime) => {
  const sites: { record: ContributionSite; reference: string | undefined; kind: string }[] = [];
  for (const record of runtime.treeItems) {
    const action = record.contribution.action;
    if (action.kind === "command") sites.push({ record, reference: refIdOf(action.command), kind: "treeItem" });
  }
  for (const record of runtime.activityItems) {
    sites.push({ record, reference: refIdOf(record.contribution.command), kind: "activityItem" });
  }
  for (const record of runtime.commands) {
    for (const menu of record.menus) {
      const reference = refIdOf(menu.command);
      if (reference) sites.push({ record, reference, kind: "menu" });
    }
  }
  for (const record of runtime.commandPaletteResources) {
    sites.push({ record, reference: refIdOf(record.contribution.queryCommand), kind: "commandPaletteResource" });
  }
  for (const record of runtime.schedules) sites.push({ record, reference: record.commandId, kind: "schedule" });
  for (const record of runtime.modes) {
    const defaultResource = record.contribution.defaultResource;
    if (defaultResource && typeof defaultResource === "object" && "commandId" in defaultResource) {
      sites.push({ record, reference: defaultResource.commandId, kind: "mode" });
    }
  }
  return sites;
};

const collectCommandReferenceDiagnostics = (runtime: ExtensionRuntime) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const known = new Set([...runtime.commands, ...runtime.privateHandlers].map((record) => record.id));

  for (const site of commandReferenceSites(runtime)) {
    if (!site.reference) continue;
    // Host-owned commands (workbench.*, dashboard.*) are registered at runtime by
    // the application, not by extensions.
    if (site.reference.startsWith("workbench.") || site.reference.startsWith("dashboard.")) continue;
    const resolved = site.reference.includes(".") ? site.reference : `${site.record.name}.${site.reference}`;
    if (known.has(resolved)) continue;
    diagnostics.push(
      createDiagnostic({
        code: "extension_command_reference_missing",
        message: `${site.kind} "${site.record.id}" references command "${site.reference}", which resolves to no registered command`,
        extensionId: site.record.extensionId,
        sourcePath: site.record.sourcePath,
        metadata: { contributionId: site.record.id, failedReference: resolved },
      }),
    );
  }
  return diagnostics;
};

export const collectConventionDiagnostics = (runtime: ExtensionRuntime) => [
  ...collectIconDiagnostics(runtime),
  ...collectIdCasingDiagnostics(runtime),
  ...collectCommandReferenceDiagnostics(runtime),
];
