import type {
  ActivityItemContribution,
  ContributionKind,
  ContributionRef,
  NavigationItemContribution,
  PlacementContribution,
  SettingsPanelContribution,
  SettingsSectionContribution,
  StatusBarItemContribution,
  StatusContribution,
  ViewContribution,
  ViewMenuContribution,
} from "@pstdio/sdk/extensions";
import type {
  NormalizedExtension,
  RuntimeActivityItemRecord,
  RuntimeNavigationItemRecord,
  RuntimePlacementRecord,
  RuntimeSettingsPanelRecord,
  RuntimeSettingsSectionRecord,
  RuntimeStatusBarItemRecord,
  RuntimeStatusRecord,
  RuntimeViewRecord,
} from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";
import { registerPrivateHandler } from "./private-handlers";
import { normalizeContributionRef } from "./references";
import { normalizeViewBody } from "./view-body";

const recordBase = contributionRecordBase;

const normalizeRef = <Kind extends ContributionKind>(ext: NormalizedExtension, ref: ContributionRef<Kind>) =>
  normalizeContributionRef(ext, ref);

const registerViews = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "view",
    contributions: contributionArray<ViewContribution>(source.definition.views),
  });
  for (const contribution of contributions) {
    const base = recordBase(ext, source, "view", contribution.id);
    if (!isLocalizableString(contribution.title) || !isRecord(contribution.body)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_view",
          message: `View "${base.id}" must define title and body`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: base.id },
        }),
      );
      continue;
    }
    const record: RuntimeViewRecord = {
      ...base,
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        body: normalizeViewBody({ ...base, ext, source, runtime, index, viewId: base.id, body: contribution.body }),
      } as RuntimeViewRecord["contribution"],
    };
    index.viewIds.set(record.id, record);
    runtime.views.push(record);
  }
};

const registerViewMenus = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "view-menu",
    contributions: contributionArray<ViewMenuContribution>(source.definition.viewMenus),
  });
  for (const contribution of contributions) {
    const base = recordBase(ext, source, "view-menu", contribution.id);
    runtime.viewMenus.push({
      ...base,
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        owner: normalizeRef(ext, contribution.owner),
        view: normalizeRef(ext, contribution.view),
      },
    });
  }
};

const normalizePlacement = (ext: NormalizedExtension, contribution: PlacementContribution) => ({
  ...contribution,
  ref: normalizeRef(ext, contribution.ref),
  mode: normalizeRef(ext, contribution.mode),
  item:
    contribution.item.kind === "view"
      ? { ...contribution.item, view: normalizeRef(ext, contribution.item.view) }
      : {
          ...contribution.item,
          slot: {
            ...contribution.item.slot,
            resourceKind: normalizeRef(ext, contribution.item.slot.resourceKind),
          },
        },
});

const registerPlacements = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "placement",
    contributions: contributionArray<PlacementContribution>(source.definition.placements),
  });
  const directPlacements = new Set<string>();
  for (const contribution of contributions) {
    const base = recordBase(ext, source, "placement", contribution.id);
    if (contribution.required && contribution.defaultOpen === false) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_placement",
          message: `Required placement "${base.id}" cannot set defaultOpen to false`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    if (contribution.movableTo && !contribution.movableTo.includes(contribution.region)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_placement",
          message: `Placement "${base.id}" must include its initial region in movableTo`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    const normalized = normalizePlacement(ext, contribution);
    const itemId =
      normalized.item.kind === "view"
        ? `${normalized.item.view.extensionId}.${normalized.item.view.id}`
        : `${normalized.item.slot.resourceKind.extensionId}.${normalized.item.slot.resourceKind.id}.${normalized.item.slot.id}`;
    const key = `${normalized.mode.extensionId}.${normalized.mode.id}:${itemId}`;
    if (directPlacements.has(key)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_view_placement",
          message: `Mode "${normalized.mode.id}" places item "${itemId}" more than once`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }
    directPlacements.add(key);
    runtime.placements.push({ ...base, contribution: normalized } as RuntimePlacementRecord);
  }
};

const registerNavigationItems = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "navigation-item",
    contributions: contributionArray<NavigationItemContribution>(source.definition.navigationItems),
  });
  for (const contribution of contributions) {
    const base = recordBase(ext, source, "navigation-item", contribution.id);
    const normalizeItem = (
      action: Exclude<NavigationItemContribution["action"], { kind: "compound" }>,
    ): Exclude<NavigationItemContribution["action"], { kind: "compound" }> => {
      if (action.kind === "view") return { ...action, view: normalizeRef(ext, action.view) };
      if (action.kind === "page") {
        const normalizePageTarget = (target: typeof action): typeof action => ({
          ...target,
          page: normalizeRef(ext, target.page),
          ...(target.parent ? { parent: normalizePageTarget(target.parent) } : {}),
        });
        return normalizePageTarget(action);
      }
      if (action.kind === "panel") {
        return {
          ...action,
          panel:
            action.panel.kind === "page-slot"
              ? { ...action.panel, page: normalizeRef(ext, action.panel.page) }
              : normalizeRef(ext, action.panel),
        };
      }
      if (action.kind === "command" && isRecord(action.target.command) && action.target.command.kind === "command") {
        return {
          ...action,
          target: { ...action.target, command: normalizeRef(ext, action.target.command as never) },
        };
      }
      return action;
    };
    const normalizeAction = (action: NavigationItemContribution["action"]): NavigationItemContribution["action"] =>
      action.kind === "compound" ? { ...action, targets: action.targets.map(normalizeItem) } : normalizeItem(action);
    const action = normalizeAction(contribution.action);
    runtime.navigationItems.push({
      ...base,
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        slot: normalizeRef(ext, contribution.slot),
        action,
      },
    } as RuntimeNavigationItemRecord);
  }
};

const registerStatusBarItems = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "status-bar-item",
    contributions: contributionArray<StatusBarItemContribution>(source.definition.statusBarItems),
  });
  for (const contribution of contributions) {
    const base = recordBase(ext, source, "status-bar-item", contribution.id);
    runtime.statusBarItems.push({
      ...base,
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        view: normalizeRef(ext, contribution.view),
        slot: contribution.slot,
      },
    } as RuntimeStatusBarItemRecord);
  }
};

const registerStatuses = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "status",
    contributions: contributionArray<StatusContribution>(source.definition.statuses),
  });
  for (const contribution of contributions) {
    const base = recordBase(ext, source, "status", contribution.id);
    const queryHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: base.id,
      rendererKind: "status",
      rendererLocalId: contribution.id,
      operation: "query",
      handler: contribution.query,
    });
    if (!queryHandlerId) continue;
    const saveHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: base.id,
      rendererKind: "status",
      rendererLocalId: contribution.id,
      operation: "save",
      handler: contribution.save,
    });
    const record = {
      ...base,
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        queryHandlerId,
        saveHandlerId,
      },
    } as RuntimeStatusRecord;
    index.statusIds.set(record.id, record);
    runtime.statuses.push(record);
  }
};

const registerActivityItems = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "activity-item",
    contributions: contributionArray<ActivityItemContribution>(source.definition.activityItems),
  });
  for (const contribution of contributions) {
    const record: RuntimeActivityItemRecord = {
      ...recordBase(ext, source, "activity-item", contribution.id),
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        command: normalizeRef(ext, contribution.command),
        modes: contribution.modes.map((mode) => normalizeRef(ext, mode)),
      },
    };
    runtime.activityItems.push(record);
  }
};

const registerSettingsSections = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "settings-section",
    contributions: contributionArray<SettingsSectionContribution>(source.definition.settingsSections),
  });
  for (const contribution of contributions) {
    const record: RuntimeSettingsSectionRecord = {
      ...recordBase(ext, source, "settings-section", contribution.id),
      contribution: { ...contribution, ref: normalizeRef(ext, contribution.ref) },
    };
    runtime.settingsSections.push(record);
  }
};

const registerSettingsPanels = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "settings-panel",
    contributions: contributionArray<SettingsPanelContribution>(source.definition.settingsPanels),
  });
  for (const contribution of contributions) {
    const record: RuntimeSettingsPanelRecord = {
      ...recordBase(ext, source, "settings-panel", contribution.id),
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        view: normalizeRef(ext, contribution.view),
        ...(contribution.section ? { section: normalizeRef(ext, contribution.section) } : {}),
      },
    };
    runtime.settingsPanels.push(record);
  }
};

export const registerUiModel = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  registerViews(ext, source, runtime, index);
  registerViewMenus(ext, source, runtime);
  registerPlacements(ext, source, runtime);
  registerNavigationItems(ext, source, runtime);
  registerStatusBarItems(ext, source, runtime);
  registerStatuses(ext, source, runtime, index);
  registerActivityItems(ext, source, runtime);
  registerSettingsSections(ext, source, runtime);
  registerSettingsPanels(ext, source, runtime);
};
