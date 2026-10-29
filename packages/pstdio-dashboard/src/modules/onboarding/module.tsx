import type { PstdioClient } from "@pstdio/sdk/client";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import type { OnboardingInfo } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { Onboarding } from "./onboarding";

const modeId = "dashboard.onboarding";
const viewId = "dashboard.onboarding.setup";
export const createOnboardingModule = (
  client: PstdioClient["onboarding"] = {
    read: () => getApiClient().onboarding.read(),
    update: (request) => getApiClient().onboarding.update(request),
  },
) => {
  let context: WorkbenchModuleContext;
  let info: OnboardingInfo;
  let complete: () => void;
  const open = async (projectId: string) => {
    const isCurrent = () => getDashboardSelectedProjectId(context) === projectId;
    const loaded = await client.read();
    if (!isCurrent()) return;
    if (loaded.state.hidden) return;
    info = loaded;
    complete = () => {
      if (!isCurrent()) return;
      context.modes.setActiveMode("project");
    };
    context.modes.setActiveMode(modeId);
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
            render: () => (
              <Onboarding info={info} update={(request) => client.update(request)} onComplete={() => complete()} />
            ),
          },
        }),
        ctx.modes.registerMode({
          id: modeId,
          canFullscreen: false,
          label: "Setup",
          panels: [],
          floatingPanels: "hidden",
          chrome: { nav: false, sidenav: false, activity: false, status: false },
          regionSettings: { main: { showHeader: false, acceptsTabs: false, canClose: false } },
          activate: () => undefined,
          enter: (modeCtx) => {
            const instanceId = modeCtx.overlays.openOverlay(viewId, { title: "Setup" });
            return { dispose: () => modeCtx.overlays.closeOverlay(instanceId) };
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
            contentHeight: "3xl",
            contentMaxWidth: "calc(100vw - {spacing.xl})",
            contentMaxHeight: "calc(100dvh - {spacing.xl})",
          },
        }),
      ];
    },
  } satisfies WorkbenchModuleContribution;
  return { module, open };
};
