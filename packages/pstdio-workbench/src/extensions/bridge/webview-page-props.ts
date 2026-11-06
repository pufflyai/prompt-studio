import type { PageLocation, ResourceRef, ViewLocation } from "@pstdio/sdk/extensions";
import { resolvePageParams } from "pstdio-api-contracts";
import type { WorkbenchPageRegistryStoreState } from "../../core";

export const resolveWebviewPageProps = (
  state: Pick<WorkbenchPageRegistryStoreState<unknown>, "pages" | "location"> | undefined,
  view?: ViewLocation & { resource?: ResourceRef },
) => {
  const pageLocation: PageLocation | undefined = view?.pageContext
    ? { ...view.pageContext, resource: view.resource }
    : state?.location;
  const page = Object.values(state?.pages ?? {}).find(
    (page) => page.ref.id === pageLocation?.page.id && page.ref.extensionId === pageLocation.page.extensionId,
  );
  return { pageLocation, pageParams: resolvePageParams(page?.params, pageLocation?.params) };
};
