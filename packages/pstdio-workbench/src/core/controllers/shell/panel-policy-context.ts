import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchRegion } from "../../registries/layout/layout-types";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { createWorkbenchInput, WorkbenchCore } from "../../workbench-core-types";
import { pageLayoutScope } from "../page-runtime/owner-layout-scope";
import type { createWorkbenchLayoutCache } from "../page-runtime/workbench-layout-cache";
import type { WorkbenchPanelPolicyContext } from "./shell-controller";

interface PolicyContextInput {
  core?: WorkbenchCore;
  host: createWorkbenchInput;
  layout: WorkbenchCore["layout"];
  modes: WorkbenchCore["modes"];
  cache: ReturnType<typeof createWorkbenchLayoutCache>;
  context?: WorkbenchPanelPolicyContext;
  region: WorkbenchRegion;
}

const ownerContext = (input: PolicyContextInput) => {
  // Layout reconciliation runs before the destination page is published.
  const current = input.core ? getWorkbenchPageRegistryInternals(input.core.pages).getPublishingState() : undefined;
  const context = input.context ?? {
    modeId: input.modes.getActiveModeId(),
    pageId: current?.activePageId,
    projectId: current?.projectId,
    resource: current?.location?.resource,
  };
  const sameMode = context.modeId === input.modes.getActiveModeId() && context.projectId === current?.projectId;
  const samePage =
    sameMode &&
    context.pageId === current?.activePageId &&
    resourceKey(context.resource) === resourceKey(current?.location?.resource);
  return { context, sameMode, samePage };
};

const ownerLayout = (input: PolicyContextInput, owner: ReturnType<typeof ownerContext>) => {
  const { region, context, layout, cache } = input;
  if (!context) return layout.getLayout();
  if (region === "side" || region === "secondary") {
    if (owner.sameMode) return layout.getLayout();
    return context.modeId
      ? (cache.readMode(context.projectId, context.modeId) ?? layout.store.getInitialState().layout)
      : layout.store.getInitialState().layout;
  }
  if ((region === "bottom" || region === "aside" || region === "main") && !owner.samePage)
    return (
      cache.layout.getLayout(
        pageLayoutScope(context, context.pageId ? input.core?.pages.getPage(context.pageId) : undefined),
      ) ?? layout.store.getInitialState().layout
    );
  return layout.getLayout();
};

const isTabPanel = (region: WorkbenchRegion) => ["main", "side", "secondary", "bottom", "aside"].includes(region);

export const panelPolicyInput = (input: PolicyContextInput) => {
  const { region, host, modes, layout, core } = input;
  const owner = ownerContext(input);
  const mode = owner.context.modeId ? modes.getMode(owner.context.modeId) : undefined;
  const page = owner.context.pageId ? core?.pages.getPage(owner.context.pageId) : undefined;
  const state = ownerLayout(input, owner).regions[region];
  let settings = layout.getRegionSettings(region);
  if (input.context) {
    settings = { ...host.regionSettings?.[region], ...mode?.regionSettings?.[region] };
    if (region === "bottom" || region === "aside") settings = page?.regionSettings?.[region];
  }
  if (region === "main") settings = { ...settings, ...page?.regionSettings?.main };
  const tabPanel = isTabPanel(region);
  let provided = !tabPanel || region === "main" || isWorkbenchModePanelAvailable(mode, region as "side" | "secondary");
  if (region === "bottom" || region === "aside") provided = Boolean(page);
  return {
    provided,
    settings,
    tabCount: state.widgets.length,
    visibility: state.visibility,
    headerVisible: state.headerVisible,
    main: region === "main",
    authoredOpen:
      host.defaultPanelOpenByRegionId?.[region] ?? (region !== "side" || host.initialSidePanelMode !== "closed"),
    legacyVisible: !tabPanel || (!mode && region !== "bottom" && region !== "aside") ? state.visible : undefined,
    legacyHeaders: !mode || mode.panelHeaders === "legacy",
    supportsFloating: region === "side",
    legacyFloatable: (mode?.floatingPanels ?? host.floatingPanels) !== "hidden",
    floatingBubble: mode?.floatingBubble,
  };
};
