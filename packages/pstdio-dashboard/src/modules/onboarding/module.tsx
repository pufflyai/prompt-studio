import type { PstdioClient } from "@pstdio/sdk/client";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import type { OnboardingInfo } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { Onboarding } from "./onboarding";

const viewId = "dashboard.onboarding.setup";
export const createOnboardingModule = (
  client: PstdioClient["onboarding"] = {
    read: () => getApiClient().onboarding.read(),
    update: (request, projectId) => getApiClient().onboarding.update(request, projectId),
  },
) => {
  let context: WorkbenchModuleContext;
  let info: OnboardingInfo;
  const open = async (projectId: string) => {
    const isCurrent = () => getDashboardSelectedProjectId(context) === projectId;
    const loaded = await client.read();
    if (!isCurrent()) return;
    if (loaded.state.hidden) return;
    info = loaded;
    context.overlays.openOverlay(viewId, { title: "Setup" });
  };
  const module = {
    id: "dashboard.onboarding",
    activate(ctx) {
      context = ctx;
      return [
        ctx.views.registerView({
          id: viewId,
          title: "Setup",
          body: {
            kind: "react",
            render: ({ instance }) => {
              const projectId = getDashboardSelectedProjectId(ctx);
              return (
                <Onboarding
                  info={info}
                  update={(request) => client.update(request, projectId)}
                  onComplete={() => ctx.overlays.closeOverlay(instance.instanceId)}
                />
              );
            },
          },
        }),
        ctx.overlays.registerOverlay({
          id: viewId,
          viewId,
          closable: false,
          config: {
            placement: "center",
            scrollBehavior: "inside",
            closeOnInteractOutside: false,
            contentWidth: "4xl",
            contentHeight: "xl",
            contentMaxWidth: "calc(100vw - {spacing.xl})",
            contentMaxHeight: "calc(100dvh - {spacing.xl})",
          },
        }),
        {
          dispose: subscribeDashboardSelectedProject(ctx, () => {
            for (const placement of ctx.layout.getLayout().regions.overlay.widgets) {
              if (placement.viewId === viewId) ctx.overlays.closeOverlay(placement.widgetId);
            }
          }),
        },
      ];
    },
  } satisfies WorkbenchModuleContribution;
  return { module, open };
};
