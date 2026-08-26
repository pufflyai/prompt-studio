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

const contributionRefId = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const ref = value as { extensionId?: unknown; kind?: unknown; id?: unknown };
  if (typeof ref.extensionId !== "string" || typeof ref.kind !== "string" || typeof ref.id !== "string")
    return undefined;
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
// runtime as `<renderer>.<operation>`, so their dots and casing are not the
// author's choice.
const localIdRecordsByKind = (runtime: ExtensionRuntime): [string, ContributionSite[]][] => [
  ["command", runtime.commands],
  ["mode", runtime.modes],
  ["view", runtime.views],
  ["viewMenu", runtime.viewMenus],
  ["placement", runtime.placements],
  ["navigationItem", runtime.navigationItems],
  ["statusBarItem", runtime.statusBarItems],
  ["status", runtime.statuses],
  ["activityItem", runtime.activityItems],
  ["resourceKind", runtime.resourceKinds],
  ["resourceView", runtime.resourceViews],
];

const isKebab = (localId: string) => localId.includes("-") && localId === localId.toLowerCase();
const isCamel = (localId: string) => /[A-Z]/.test(localId);

const collectIdCasingDiagnostics = (runtime: ExtensionRuntime) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  // Casing is compared inside one contribution kind: this repo deliberately uses
  // kebab-case commands beside camelCase renderer and panel ids.
  const byExtensionKind = new Map<string, ContributionSite[]>();
  for (const [kind, records] of localIdRecordsByKind(runtime)) {
    for (const record of records) {
      const key = `${record.extensionId}\0${kind}`;
      byExtensionKind.set(key, [...(byExtensionKind.get(key) ?? []), record]);
    }
  }

  for (const record of localIdRecordsByKind(runtime).flatMap(([, records]) => records)) {
    // A dotted local id collides with the namespaced `<extension>.<id>` reference
    // form, so references to it resolve to the wrong extension.
    if (!record.localId.includes(".")) continue;
    diagnostics.push(
      createDiagnostic({
        code: "extension_contribution_id_casing",
        severity: "warning",
        message: `Contribution id "${record.localId}" contains "."; dots are reserved for cross-extension references`,
        extensionId: record.extensionId,
        sourcePath: record.sourcePath,
        metadata: { contributionId: record.id, reason: "dotted-local-id" },
      }),
    );
  }

  for (const [key, records] of byExtensionKind) {
    const [extensionId, kind] = key.split("\0");
    const kebab = records.find((record) => isKebab(record.localId));
    const camel = records.find((record) => isCamel(record.localId));
    if (!kebab || !camel) continue;
    diagnostics.push(
      createDiagnostic({
        code: "extension_contribution_id_casing",
        severity: "warning",
        message: `Extension mixes ${kind} id styles: "${kebab.localId}" (kebab-case) and "${camel.localId}" (camelCase); pick one`,
        extensionId: extensionId!,
        sourcePath: kebab.sourcePath,
        metadata: { reason: "mixed-casing", kind, examples: [kebab.localId, camel.localId] },
      }),
    );
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
  ...collectIdCasingDiagnostics(runtime),
  ...collectCommandReferenceDiagnostics(runtime),
  ...collectViewReferenceDiagnostics(runtime),
];
