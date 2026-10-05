import "@pstdio/ui/style.css";

import { HostStorageProvider } from "@pstdio/ui";
import { Workbench } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { connectDesktopCommands } from "@/lib/desktop-commands";
import { resolveDesktopLifecycleBridge } from "@/lib/desktop-lifecycle-bridge";
import { createDesktopProjectTabs } from "@/lib/desktop-project-tabs-bridge";
import { createDesktopWorkbenchStorage } from "@/lib/desktop-workbench-storage";
import { dashboardQueryClient } from "@/lib/query-client";
import { SyncProvider } from "@/lib/sync/sync-provider";
import { DesktopQuitConfirmation } from "@/modules/desktop/desktop-quit-confirmation";
import { DesktopStartupAppearance } from "@/modules/desktop/desktop-startup-appearance";
import { DesktopProjectTabs } from "@/modules/projects/components/desktop-project-tabs";
import { openDashboardSidePanel } from "@/modules/sessions/bubble/open-side-panel";
import { createDashboardParamFieldRenderer } from "@/shared/command-params/dashboard-param-field";

import { createDashboardWorkbench } from "./workbench";
import "./i18n";

const renderDashboard = async () => {
  const storage = await createDesktopWorkbenchStorage(window.promptStudioDesktop);
  const projectTabs = await createDesktopProjectTabs(window.promptStudioDesktop);
  const desktopLifecycle = resolveDesktopLifecycleBridge(window.promptStudioDesktop);
  const dashboardWorkbench = createDashboardWorkbench({
    storage,
    projectTabs: projectTabs?.controller,
    // Send native layout writes before a following Quit request can close the renderer.
    layoutDebounceMs: storage ? 0 : undefined,
  });
  const stopDesktopCommands = connectDesktopCommands(window.promptStudioDesktop, dashboardWorkbench);
  if (stopDesktopCommands) window.addEventListener("pagehide", stopDesktopCommands, { once: true });
  (window as unknown as Record<string, unknown>).__pstdioDashboardWorkbench = dashboardWorkbench;
  const renderParamField = createDashboardParamFieldRenderer(dashboardWorkbench);

  const root = createRoot(document.getElementById("root")!);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    root.unmount();
    void dashboardWorkbench.dispose();
  });
  root.render(
    <StrictMode>
      <QueryClientProvider client={dashboardQueryClient}>
        <HostStorageProvider storage={storage}>
          <SyncProvider>
            <Workbench
              workbench={dashboardWorkbench}
              themeStorage={storage}
              titleBar={
                <>
                  {projectTabs && <DesktopProjectTabs workbench={dashboardWorkbench} {...projectTabs} />}
                  {desktopLifecycle && <DesktopStartupAppearance bridge={desktopLifecycle} />}
                  {desktopLifecycle && <DesktopQuitConfirmation bridge={desktopLifecycle} />}
                </>
              }
              renderParamField={renderParamField}
              onOpenSidePanel={() => void openDashboardSidePanel(dashboardWorkbench)}
            />
          </SyncProvider>
        </HostStorageProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
};

void renderDashboard();
