import type {
  ActivityItemContribution,
  ContributionKind,
  ContributionRef,
  NavigationItemContribution,
  NavigationTreeContribution,
  SettingsPanelContribution,
  SettingsSectionContribution,
  StatusBarItemContribution,
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
  RuntimeViewRecord,
} from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator, RegistryIndex } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { validateDeclaration } from "./declaration-diagnostic";
import { normalizeNavigationAction } from "./navigation-action";
import { navigationItemDeclarationSchema } from "./navigation-declaration";
import { registerPlacements } from "./placements";
import { normalizeContributionRef } from "./references";
import { normalizeViewBody } from "./view-body";
import { viewDeclarationSchema } from "./view-declaration";

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
    if (!validateDeclaration({ ext, source, runtime, kind: "view", contribution, schema: viewDeclarationSchema }))
      continue;
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
    if (
      !validateDeclaration({
        ext,
        source,
        runtime,
        kind: "navigation-item",
        contribution,
        schema: navigationItemDeclarationSchema,
      })
    )
      continue;
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
        popover: contribution.popover ? normalizeRef(ext, contribution.popover) : undefined,
        slot: contribution.slot,
      },
    } as RuntimeStatusBarItemRecord);
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
  registerActivityItems(ext, source, runtime);
  registerSettingsSections(ext, source, runtime);
  registerSettingsPanels(ext, source, runtime);
};
