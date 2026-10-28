import type { PstdioClient } from "@pstdio/sdk/client";
import { type PageRef, workbenchPages } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import type { OnboardingInfo } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";
import { pageTargetFromLocation } from "@/shared/workbench/page-navigation";
import { Customizations } from "./customizations";
import { Onboarding } from "./onboarding";

const modeId = "dashboard.onboarding";
const viewId = "dashboard.onboarding.setup";
const page: PageRef = { extensionId: "pstdio", kind: "page", id: "onboarding" };
export const createOnboardingModule = (
  client: PstdioClient["onboarding"] = {
    read: () => getApiClient().onboarding.read(),
    update: (request) => getApiClient().onboarding.update(request),
  },
) => {
  let context: WorkbenchModuleContext;
  let info: OnboardingInfo;
  let complete: () => void;
  let setupPage: { dispose(): void } | undefined;
  const open = async (onComplete: () => void, isCurrent: () => boolean) => {
    setupPage?.dispose();
    setupPage = undefined;
    context.modes.setActiveMode(modeId);
    info = await client.read();
    if (!isCurrent()) return false;
    if (info.state.completed || info.state.hidden) return true;
    const projectId = context.pages.store.getState().projectId!;
    const previous = context.pageLocations.getBootLocation(projectId);
    complete = () => {
      if (!isCurrent()) return;
      onComplete();
      const target =
        previous && previous.page.id !== page.id
          ? pageTargetFromLocation(previous)
          : { kind: "page" as const, page: workbenchPages.start };
      const restored = context.pageLocations.navigate(target);
      if (!restored.ok) context.pageLocations.navigate({ kind: "page", page: workbenchPages.start });
      setupPage?.dispose();
      setupPage = undefined;
    };
    setupPage = context.pages.registerPage({
      id: page.id,
      ref: page,
      title: "Setup",
      modeId,
      path: "setup",
      main: { kind: "view", cardinality: "one", presentation: "page", view: { kind: "view", id: viewId } },
      slots: [],
    });
    context.pageLocations.navigate({ kind: "page", page });
    return false;
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
          panels: ["main"],
          floatingPanels: "hidden",
          chrome: { nav: false, sidenav: false, activity: false },
          regionSettings: { main: { showHeader: false, acceptsTabs: false, canClose: false } },
          activate: () => undefined,
        }),
        ctx.views.registerView({
          id: "dashboard.settings.customizations",
          title: "Customizations",
          body: { kind: "react", render: () => <Customizations /> },
        }),
        ctx.settings.registerPanel({
          id: "customizations",
          title: "Customizations",
          section: "workbench",
          kind: "view",
          scope: "global",
          order: 30,
          icon: "SlidersHorizontal",
          viewId: "dashboard.settings.customizations",
        }),
      ];
    },
  } satisfies WorkbenchModuleContribution;
  return { module, open };
};
