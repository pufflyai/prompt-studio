import type {
  ActivityItemContribution,
  ContributionKind,
  ContributionRef,
  NavigationItemContribution,
  NavigationTreeContribution,
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
  RuntimeNavigationTreeRecord,
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
import { normalizeNavigationAction } from "./navigation-action";
import { registerPlacements } from "./placements";
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
    const action = normalizeNavigationAction(ext, contribution.action);
    runtime.navigationItems.push({
      ...base,
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        owner: normalizeRef(ext, contribution.owner),
        slot: contribution.slot ?? "content",
        action,
      },
    } as RuntimeNavigationItemRecord);
  }
};

const registerNavigationTrees = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "navigation-tree",
    contributions: contributionArray<NavigationTreeContribution>(source.definition.navigationTrees),
  });
  for (const contribution of contributions) {
    const base = recordBase(ext, source, "navigation-tree", contribution.id);
    runtime.navigationTrees.push({
      ...base,
      contribution: {
        ...contribution,
        ref: normalizeRef(ext, contribution.ref),
        owner: normalizeRef(ext, contribution.owner),
        slot: contribution.slot ?? "content",
        view: normalizeRef(ext, contribution.view),
      },
    } as RuntimeNavigationTreeRecord);
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
  registerPlacements(ext, source, runtime, index);
  registerNavigationItems(ext, source, runtime);
  registerNavigationTrees(ext, source, runtime);
  registerStatusBarItems(ext, source, runtime);
  registerStatuses(ext, source, runtime, index);
  registerActivityItems(ext, source, runtime);
  registerSettingsSections(ext, source, runtime);
  registerSettingsPanels(ext, source, runtime);
};
