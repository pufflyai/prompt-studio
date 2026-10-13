import { contributionRefId, type ModeRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { pageAllowsMode } from "../../registries/pages/page-availability";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import { locationModeRef } from "../page-location/page-mode-locations";
import { openOwnerLayouts, pageOwnerLocation } from "../page-runtime/open-owner-layouts";
import { pageLayoutScope } from "../page-runtime/owner-layout-scope";
import { resourceEditorPageTarget } from "./resource-editor-page-target";
import type { OpenResourceEditor } from "./resource-editor-resolver";
import { resourceEditorTarget } from "./resource-editor-target";

const pageOwnerMode = (page: WorkbenchPageContribution, requested: ModeRef | undefined, activeModeId?: string) => {
  if (requested && pageAllowsMode(page, contributionRefId(requested))) return requested;
  if (!page.modeIds) return undefined;
  const modeId = pageAllowsMode(page, activeModeId) ? activeModeId! : page.modeId;
  return locationModeRef(modeId);
};

const mainEditorOwnerTarget = (
  core: WorkbenchCore,
  editor: OpenResourceEditor,
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[],
  page: WorkbenchPageContribution,
  activeModeId?: string,
) => {
  let requested = targets.at(-1);
  if (requested?.kind !== "page") {
    const context = targets
      .filter((target): target is NavigationTargetPage => target.kind === "page")
      .filter((target) => contributionRefId(target.page) === contributionRefId(page.ref))
      .at(-1);
    if (context) requested = { ...context, resource: editor.tab.resource };
  }
  return resourceEditorPageTarget(core, page.ref, editor.tab.resource, {
    ...(requested?.kind === "page" ? requested : {}),
    kind: "page",
    page: page.ref,
    resource: requested?.resource ?? editor.tab.resource,
    mode: pageOwnerMode(page, requested?.kind === "page" ? requested.mode : undefined, activeModeId),
  });
};

export const resourceEditorOwnerTarget = (
  core: WorkbenchCore,
  editor: OpenResourceEditor,
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[],
  current: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const owner = editor.tab.placementIdentity;
  const explicit = targets
    .filter((t): t is NavigationTargetPage => t.kind === "page")
    .filter((t) => {
      const match = resourceEditorTarget(core, t);
      return (
        !match || match.viewId !== editor.tab.viewId || resourceKey(match.resource) !== resourceKey(editor.tab.resource)
      );
    })
    .at(-1);
  if (owner?.kind === "page") {
    const ownerPage = core.pages.getPage(owner.pageId);
    if (
      editor.region === "main" &&
      editor.tab.role === "location" &&
      ownerPage?.resource &&
      ownerPage.main.kind === "view"
    )
      return mainEditorOwnerTarget(core, editor, targets, ownerPage, current.activeModeId);
    const page = current.activePageId ? current.pages[current.activePageId] : undefined;
    if (
      editor.scope ===
      pageLayoutScope(
        {
          projectId: current.projectId,
          pageId: current.activePageId,
          resource: current.location?.resource,
        },
        page,
      )
    ) {
      return undefined;
    }
    const target = editor.scope ? pageOwnerLocation(core, editor.scope) : undefined;
    if (!target || !ownerPage) return target;
    return { ...target, mode: pageOwnerMode(ownerPage, undefined, current.activeModeId) };
  }
  if (owner?.kind !== "mode" || owner.modeId === current.activeModeId) return explicit;
  const layouts = openOwnerLayouts(core);
  const mainId = layouts.find((entry) => entry.scope === editor.scope)?.layout.activeLocationWidgetId;
  const lastPage = layouts.find(
    (entry) =>
      entry.scope?.includes("/owner/page/") &&
      Object.values(entry.layout.regions).some((region) => region.widgets.some((tab) => tab.widgetId === mainId)),
  );
  const basePage = core.modes.getMode(owner.modeId)?.basePage;
  const home = core.pages
    .listPages()
    .find((page) => pageAllowsMode(page, owner.modeId) && !page.resource && !page.parentId);
  const candidates = [
    explicit,
    lastPage?.scope ? pageOwnerLocation(core, lastPage.scope) : undefined,
    targets.filter((target): target is NavigationTargetPage => target.kind === "page").at(-1),
    ...(basePage ? [{ kind: "page" as const, page: basePage }] : []),
    ...(home ? [{ kind: "page" as const, page: home.ref }] : []),
  ];
  const target = candidates.find((target) => {
    const page =
      target && core.pages.listPages().find((p) => contributionRefId(p.ref) === contributionRefId(target.page));
    return page && pageAllowsMode(page, owner.modeId);
  });
  if (!target) throw new Error(`Editor owner has no available page: ${owner.modeId}`);
  return { ...target, mode: locationModeRef(owner.modeId) };
};
