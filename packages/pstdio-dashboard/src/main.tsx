import "@pstdio/ui/style.css";

import { PstdioApiError } from "@pstdio/sdk/client";
import { HostStorageProvider } from "@pstdio/ui";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { apiRequest } from "@/lib/api";
import { connectDesktopCommands } from "@/lib/desktop-commands";
import { resolveDesktopLifecycleBridge } from "@/lib/desktop-lifecycle-bridge";
import { createDesktopProjectTabs } from "@/lib/desktop-project-tabs-bridge";
import { createDesktopWorkbenchStorage } from "@/lib/desktop-workbench-storage";
import { dashboardQueryClient } from "@/lib/query-client";
import { createConnectionStatusSettings } from "@/lib/sync/connection-status-settings";
import { SyncProvider } from "@/lib/sync/sync-provider";
import { DesktopQuitConfirmation } from "@/modules/desktop/desktop-quit-confirmation";
import { DesktopStartupAppearance } from "@/modules/desktop/desktop-startup-appearance";
import { DesktopProjectTabs } from "@/modules/projects/components/desktop-project-tabs";
import { openDashboardSidePanel } from "@/modules/sessions/bubble/open-side-panel";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { createDashboardParamFieldRenderer } from "@/shared/command-params/dashboard-param-field";
import { BrowserSignInRequired } from "@/shared/components/browser-sign-in-required";

import { createDashboardWorkbench } from "./workbench";
import "./i18n";

// A runtime accepts a browser only with the session that `pst` or the desktop app gives it.
// A server without auth has no runtime routes and answers 404.
const isBrowserSignedOut = async () => {
  try {
    await apiRequest("/runtime/ready", { allowNotFound: true });
    return false;
  } catch (error) {
    return error instanceof PstdioApiError && error.status === 401;
  }
};

const renderDashboard = async () => {
  const root = createRoot(document.getElementById("root")!);
  if (await isBrowserSignedOut()) {
    root.render(
      <StrictMode>
        <WorkbenchThemeProvider>
          <BrowserSignInRequired />
        </WorkbenchThemeProvider>
      </StrictMode>,
    );
    return;
  }

  const storage = await createDesktopWorkbenchStorage(window.promptStudioDesktop);
  const connectionStatusSettings = createConnectionStatusSettings(resolveDashboardStorage(storage));
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

  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    root.unmount();
    void dashboardWorkbench.dispose();
  });
  root.render(
    <StrictMode>
      <QueryClientProvider client={dashboardQueryClient}>
        <HostStorageProvider storage={storage}>
          <SyncProvider workbench={dashboardWorkbench} connectionStatusSettings={connectionStatusSettings}>
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
