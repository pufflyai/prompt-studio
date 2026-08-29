import { isValidLocalContributionId, localContributionIdGrammar } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionDiagnostic, ExtensionRuntime } from "../types/runtime";
import { createDiagnostic } from "./diagnostics";
import { workbenchIconNames } from "./workbench-icon-names";

// Convention diagnostics for `extensions check`: invalid icon names, contribution ids
// outside the shared grammar, and dangling command references. They run over the
// normalized runtime so every check sees resolved contribution ids.

const toKebabIconName = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();

// Host-owned contributions (extensionId "pstdio") are registered at runtime by the
// application, not by extensions, so references to them cannot be resolved here and
// are skipped by returning undefined.
const contributionRefId = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const ref = value as { extensionId?: unknown; kind?: unknown; id?: unknown };
  if (typeof ref.extensionId !== "string" || typeof ref.kind !== "string" || typeof ref.id !== "string")
    return undefined;
  if (ref.extensionId === "pstdio") return undefined;
  return `${ref.extensionId}.${ref.kind}.${ref.id}`;
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
  for (const record of runtime.views) sites.push({ record, icon: record.contribution.icon, kind: "view" });
  for (const record of runtime.navigationItems) {
    sites.push({ record, icon: record.contribution.icon, kind: "navigationItem" });
  }
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

// Only author-declared ids are checked. Private handler ids are synthesized by the
// runtime as `<renderer>.<operation>`, so their shape is not the author's choice.
const localIdRecordsByKind = (runtime: ExtensionRuntime): [string, ContributionSite[]][] => [
  ["activityItem", runtime.activityItems],
  ["artifactMount", runtime.artifactMounts],
  ["command", runtime.commands],
  ["commandPaletteResource", runtime.commandPaletteResources],
  ["connection", runtime.connections],
  ["fileIconTheme", runtime.fileIconThemes],
  ["harness", runtime.harnesses],
  ["hook", runtime.hooks],
  ["keybinding", runtime.keybindings],
  ["middleware", runtime.middlewares],
  ["mode", runtime.modes],
  ["navigationItem", runtime.navigationItems],
  ["placement", runtime.placements],
  ["resourceHierarchyProvider", runtime.resourceHierarchyProviders],
  ["resourceKind", runtime.resourceKinds],
  ["resourceView", runtime.resourceViews],
  ["schedule", runtime.schedules],
  ["settingsPanel", runtime.settingsPanels],
  ["settingsSection", runtime.settingsSections],
  ["skill", runtime.skills],
  ["status", runtime.statuses],
  ["statusBarItem", runtime.statusBarItems],
  ["template", runtime.templates],
  ["templateType", runtime.templateTypes],
  ["theme", runtime.themes],
  ["view", runtime.views],
  ["viewMenu", runtime.viewMenus],
];

const invalidIdDiagnostic = (kind: string, record: ContributionSite, localId: string) =>
  createDiagnostic({
    code: "extension_contribution_id_invalid",
    message: `${kind} id "${localId}" is invalid; local contribution ids use ${localContributionIdGrammar}`,
    extensionId: record.extensionId,
    sourcePath: record.sourcePath,
    metadata: { contributionId: record.id, invalidId: localId },
  });

const collectIdGrammarDiagnostics = (runtime: ExtensionRuntime) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  for (const [kind, records] of localIdRecordsByKind(runtime)) {
    for (const record of records) {
      if (isValidLocalContributionId(record.localId)) continue;
      diagnostics.push(invalidIdDiagnostic(kind, record, record.localId));
    }
  }
  // Resource-kind slot and menu-slot ids are author-declared identifiers too: other
  // extensions reference them, so they follow the same grammar.
  for (const record of runtime.resourceKinds) {
    const { slots, menuSlots } = record.contribution;
    for (const slotId of [...Object.keys(slots), ...Object.keys(menuSlots)]) {
      if (isValidLocalContributionId(slotId)) continue;
      diagnostics.push(invalidIdDiagnostic("resourceKind slot", record, slotId));
    }
  }
  return diagnostics;
};

const commandReferenceSites = (runtime: ExtensionRuntime) => {
  const sites: { record: ContributionSite; reference: string | undefined; kind: string }[] = [];
  for (const record of runtime.activityItems) {
    sites.push({ record, reference: contributionRefId(record.contribution.command), kind: "activityItem" });
  }
  for (const record of runtime.schedules) sites.push({ record, reference: record.commandId, kind: "schedule" });
  for (const record of runtime.navigationItems) {
    const collect = (action: (typeof record.contribution)["action"]) => {
      if (action.kind === "command")
        sites.push({ record, reference: contributionRefId(action.target.command), kind: "navigationItem" });
      if (action.kind === "compound") action.targets.forEach(collect);
    };
    collect(record.contribution.action);
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
    if (site.reference.startsWith("pstdio.command.")) continue;
    if (known.has(site.reference)) continue;
    diagnostics.push(
      createDiagnostic({
        code: "extension_command_reference_missing",
        message: `${site.kind} "${site.record.id}" references command "${site.reference}", which resolves to no registered command`,
        extensionId: site.record.extensionId,
        sourcePath: site.record.sourcePath,
        metadata: { contributionId: site.record.id, failedReference: site.reference },
      }),
    );
  }
  return diagnostics;
};

const collectViewReferenceDiagnostics = (runtime: ExtensionRuntime) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const known = new Set(runtime.views.map((record) => record.id));
  const sites: { record: ContributionSite; reference: string | undefined; kind: string }[] = [];
  for (const record of runtime.placements) {
    if (record.contribution.item.kind === "view")
      sites.push({ record, reference: contributionRefId(record.contribution.item.view), kind: "placement" });
  }
  for (const record of runtime.settingsPanels)
    sites.push({ record, reference: contributionRefId(record.contribution.view), kind: "settingsPanel" });
  for (const record of runtime.statusBarItems)
    sites.push({ record, reference: contributionRefId(record.contribution.view), kind: "statusBarItem" });
  for (const site of sites) {
    if (!site.reference || known.has(site.reference)) continue;
    diagnostics.push(
      createDiagnostic({
        code: "extension_view_reference_missing",
        message: `${site.kind} "${site.record.id}" references unknown view "${site.reference}"`,
        extensionId: site.record.extensionId,
        sourcePath: site.record.sourcePath,
        metadata: { contributionId: site.record.id, failedReference: site.reference },
      }),
    );
  }

  return diagnostics;
};

export const collectConventionDiagnostics = (runtime: ExtensionRuntime) => [
  ...collectIconDiagnostics(runtime),
  ...collectIdGrammarDiagnostics(runtime),
  ...collectCommandReferenceDiagnostics(runtime),
  ...collectViewReferenceDiagnostics(runtime),
];
