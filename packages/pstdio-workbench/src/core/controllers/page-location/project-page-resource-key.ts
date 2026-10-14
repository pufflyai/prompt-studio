import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";

export const createProjectPageResourceKey =
  (resources: WorkbenchPageResourceCodec, getProjectId: () => string | undefined) => (resource: ResourceRef) =>
    resources.toUri(resources.normalize({ ...resource, projectId: resource.projectId ?? getProjectId() }));
