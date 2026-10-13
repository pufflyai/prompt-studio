import { contributionRefId, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { pageAllowsMode } from "../../registries/pages/page-availability";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { locationModeRef } from "../page-location/page-mode-locations";
import { openOwnerLayouts, pageOwnerLocation } from "../page-runtime/open-owner-layouts";
import { pageLayoutScope } from "../page-runtime/owner-layout-scope";
import { type OpenResourceEditor, resourceEditorTarget } from "./resource-editor-resolver";

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
      return {
        kind: "page" as const,
        page: ownerPage.ref,
        resource: editor.tab.resource,
        mode: targets
          .filter((target): target is NavigationTargetPage => target.kind === "page")
          .reverse()
          .find(
            (target) =>
              target.kind === "page" &&
              contributionRefId(target.page) === contributionRefId(ownerPage.ref) &&
              resourceKey(target.resource) === resourceKey(editor.tab.resource),
          )?.mode,
      };
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
    return editor.scope ? pageOwnerLocation(core, editor.scope) : undefined;
  }
  if (owner?.kind !== "mode" || owner.modeId === current.activeModeId) return explicit;
  const layouts = openOwnerLayouts(core);
  const mainId = layouts.find((entry) => entry.scope === editor.scope)?.layout.activeLocationWidgetId;
  const lastPage = layouts.find(
    (entry) =>
      entry.scope?.includes("/owner/page/") &&
      Object.values(entry.layout.regions).some((region) => region.widgets.some((tab) => tab.widgetId === mainId)),
  );
  const mode = core.modes.getMode(owner.modeId);
  const home = core.pages
    .listPages()
    .find((page) => pageAllowsMode(page, owner.modeId) && !page.resource && !page.parentId);
  const candidates = [
    explicit,
    lastPage?.scope ? pageOwnerLocation(core, lastPage.scope) : undefined,
    ...(mode?.basePage ? [{ kind: "page" as const, page: mode.basePage }] : []),
    ...(home ? [{ kind: "page" as const, page: home.ref }] : []),
  ];
  const target = candidates.find((target) => {
    const page =
      target && core.pages.listPages().find((page) => contributionRefId(page.ref) === contributionRefId(target.page));
    return page && pageAllowsMode(page, owner.modeId);
  });
  if (!target) throw new Error(`Editor owner has no available page: ${owner.modeId}`);
  return { ...target, mode: locationModeRef(owner.modeId) };
};
