import { defaultPageResourceCodec, parseWorkbenchPageUrl } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { getProjectExtensionMetadata } from "@/shared/extensions/api";

export const openProjectPageUrl = async (input: {
  workbench: WorkbenchCore;
  href: string;
  projectId: string;
  sourceProjectId: string;
}) => {
  const [, metadata] = await Promise.all([
    getApiClient().projects.get(input.projectId),
    getProjectExtensionMetadata(input.projectId),
  ]);
  if (getDashboardSelectedProjectId(input.workbench) !== input.sourceProjectId) return;
  const pages = [
    ...input.workbench.pages.listPages().filter((page) => page.ref.extensionId === "pstdio"),
    ...metadata.pages.map((page) => ({
      id: page.id,
      ref: { kind: "page" as const, extensionId: page.extensionId, id: page.localId },
      path: page.path,
      document: page.document,
    })),
  ];
  if (
    !parseWorkbenchPageUrl({ url: input.href, projectId: input.projectId, pages, resources: defaultPageResourceCodec })
  )
    throw new Error("This page or document link is unavailable in its project.");
  // Project changes release retained views. A browser navigation lets URL bootstrap
  // select the destination and lets Back restore the source project as one entry.
  window.location.assign(input.href);
};
