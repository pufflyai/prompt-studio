import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";

export const resourceEditorPageTarget = (
  core: WorkbenchCore,
  page: PageRef,
  resource: ResourceRef | undefined,
  requested: NavigationTargetPage | NavigationTargetPanel | undefined,
) => ({
  kind: "page" as const,
  page,
  resource: requested?.resource
    ? getWorkbenchPageRegistryInternals(core.pages).resources.normalize(requested.resource)
    : resource,
  ...(requested?.kind === "page"
    ? { mode: requested.mode, section: requested.section, position: requested.position, parent: requested.parent }
    : {}),
});
