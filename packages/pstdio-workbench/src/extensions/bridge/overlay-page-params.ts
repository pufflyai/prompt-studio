import type { PageLocation, WebviewPageParamsUpdateParams } from "@pstdio/sdk/extensions";
import { normalizePageParams } from "pstdio-api-contracts";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";

export const updateOverlayPageParams = (
  workbench: WorkbenchCore,
  placement: WorkbenchPanelInstance,
  extensionId: string | undefined,
  patch: WebviewPageParamsUpdateParams["params"],
) => {
  const current = workbench.layout
    .getLayout()
    .regions.overlay.widgets.find((item) => item.widgetId === placement.instanceId);
  const context = current?.pageContext;
  if (!current || !context) throw new Error("The calling viewer is no longer open");
  if (!extensionId || extensionId !== context.page.extensionId) throw new Error("page_params_not_owner");
  const page = workbench.pages
    .listPages()
    .find((page) => page.ref.id === context.page.id && page.ref.extensionId === context.page.extensionId);
  const values = { ...context.params };
  for (const [name, value] of Object.entries(patch)) {
    if (!page?.params || !Object.hasOwn(page.params, name)) throw new Error(`page_param_invalid: ${name}`);
    if (value === null) delete values[name];
    else values[name] = value;
  }
  const params = normalizePageParams(page?.params, values);
  const pageContext = { ...context, params };
  workbench.layout.updatePanel(placement.instanceId, { pageContext });
  return { ...pageContext, resource: current.resource } satisfies PageLocation;
};
