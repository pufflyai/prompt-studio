import type { ExtensionContextBase, ResourceRef, WebviewHostCapabilityResults } from "@pstdio/sdk/extensions";
import { workbenchResourceKinds } from "@pstdio/sdk/extensions";

export type HomeHarness = WebviewHostCapabilityResults["harnesses.read"]["harnesses"][number];

export interface RecentProjectResource {
  id: string;
  title: string;
  icon: string;
  updatedAt: string;
  resource: ResourceRef;
}

export const readHome = async (ctx: ExtensionContextBase) => {
  const [recent, workspace] = await Promise.all([
    ctx.sessions.query({ orderBy: "updated", limit: 5 }),
    ctx.workspaces.getDefault(),
  ]);
  return {
    project: ctx.project,
    setupError: workspace?.setupError ?? null,
    recent: recent.items.map((session) => ({
      id: session.id,
      title: session.title || "Session",
      icon: "message-circle",
      updatedAt: session.updatedAt,
      resource: {
        type: "session",
        extensionId: workbenchResourceKinds.session.extensionId,
        id: session.id,
        projectId: ctx.projectId,
        label: session.title,
        icon: "message-circle",
      },
    })),
  };
};
