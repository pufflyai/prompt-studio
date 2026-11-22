import type { WebviewPageParamsUpdateParams } from "@pstdio/sdk/extensions";
import { normalizePageParams } from "pstdio-api-contracts";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { portablePagePanel } from "../../core/controllers/page-runtime/portable-page-panel";
import { currentViewerSource } from "../../core/controllers/resource-viewers/viewer-source";
import { isPageContent, isSingleViewPage } from "../../core/registries/pages/page-main";

export const updatePortablePageParams = (
  workbench: WorkbenchCore,
  placement: WorkbenchPanelInstance,
  extensionId: string | undefined,
  patch: WebviewPageParamsUpdateParams["params"],
) => {
  if (!placement.placementIdentity) return;
  const current = currentViewerSource(workbench, placement.placementIdentity);
  const context = current?.widget.pageContext;
  if (!current || !context) return;
  const page = workbench.pages
    .listPages()
    .find((page) => page.ref.id === context.page.id && page.ref.extensionId === context.page.extensionId);
  if (!isSingleViewPage(page) || isPageContent(page, current.identity)) return;
  const panel = portablePagePanel(page!, workbench.modePlacements);
  const owner = panel && workbench.modePlacements.getPlacement(panel);
  if (current.identity.kind !== "mode" || current.identity.placementId !== owner?.id) return;
  if (!extensionId || extensionId !== context.page.extensionId) throw new Error("page_params_not_owner");
  const values = { ...context.params };
  for (const [name, value] of Object.entries(patch)) {
    if (!page?.params || !Object.hasOwn(page.params, name)) throw new Error(`page_param_invalid: ${name}`);
    if (value === null) delete values[name];
    else values[name] = value;
  }
  const params = normalizePageParams(page?.params, values);
  const pageContext = { ...context, params };
  workbench.modePlacements.updatePlacement(current.identity, {
    location: { pageContext, section: current.widget.section, position: current.widget.position },
  });
  return {
    ...pageContext,
    resource: current.resource,
    section: current.widget.section,
    position: current.widget.position,
  };
};
