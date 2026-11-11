import "@pstdio/ui/style.css";

import { PstdioApiError } from "@pstdio/sdk/client";
import { HostStorageProvider } from "@pstdio/ui";
import { WorkbenchThemeProvider } from "@pstdio/workbench/react";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getApiClient } from "@/lib/api";
import { storeBrowserSession, takeBrowserLoginCode, waitForBrowserLoginLink } from "@/lib/browser-session";
import { connectDesktopCommands } from "@/lib/desktop-commands";
import { resolveDesktopLifecycleBridge } from "@/lib/desktop-lifecycle-bridge";
import { createDesktopProjectTabs } from "@/lib/desktop-project-tabs-bridge";
import { createDesktopWorkbenchStorage } from "@/lib/desktop-workbench-storage";
import { SyncProvider } from "@/lib/sync/sync-provider";
import { DesktopQuitConfirmation } from "@/modules/desktop/desktop-quit-confirmation";
import { DesktopStartupAppearance } from "@/modules/desktop/desktop-startup-appearance";
import { createPerformanceMonitoring } from "@/modules/performance/module";
import type { DesktopProjectTabsController } from "@/modules/projects/desktop-project-tabs-controller";
import { dashboardWorkbenchStorageNamespace } from "@/shared/app/dashboard-workbench-storage-keys";
import { createDashboardPageLocationBrowser, readPageUrlProjectId } from "@/shared/app/page-location-browser";
import { createDashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { BrowserSignInRequired } from "@/shared/components/browser-sign-in-required";
import { DashboardWorkbenchView } from "@/shared/workbench/dashboard-workbench-view";
import { DesktopProjectWorkbenches } from "./desktop-project-workbenches";
import { createDashboardWorkbench } from "./workbench";
import "./i18n";

// `pst` and the desktop app open a login link with a single-use code in the fragment (ADR 0057).
// The code leaves the address bar first, so a reload or a copied URL never carries it.
const signInFromLoginLink = async ({ code, hash }: ReturnType<typeof takeBrowserLoginCode>) => {
  if (!code) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
  try {
    const { secret } = await getApiClient().runtime.claimBrowserSession(code);
    storeBrowserSession(secret);
  } catch {
    // A used or expired code leaves the browser signed out, and the sign-in page explains what to do.
  }
};

// A runtime accepts a browser only with the session that `pst` or the desktop app gives it.
// A server without auth has no runtime routes and answers 404.
const isBrowserSignedOut = async () => {
  try {
    await getApiClient().runtime.ready();
    return false;
  } catch (error) {
    return error instanceof PstdioApiError && error.status === 401;
  }
};

const renderDashboard = async () => {
  const root = createRoot(document.getElementById("root")!);
  const initialLink = takeBrowserLoginCode(window.location.hash);
  const url = new URL(window.location.href);
  const preparingDesktop = Boolean(window.promptStudioDesktop) && url.searchParams.has("desktop-startup");
  if (preparingDesktop) {
    url.searchParams.delete("desktop-startup");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  const login = preparingDesktop && !initialLink.code ? await waitForBrowserLoginLink() : initialLink;
  // After the initial native link arrives, later links restart an already loading or mounted dashboard.
  window.addEventListener("hashchange", () => {
    if (takeBrowserLoginCode(window.location.hash).code) window.location.reload();
  });
  await signInFromLoginLink(login);
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

  const [storage, projectTabs] = await Promise.all([
    createDesktopWorkbenchStorage(window.promptStudioDesktop),
    createDesktopProjectTabs(window.promptStudioDesktop),
  ]);
  const desktopLifecycle = resolveDesktopLifecycleBridge(window.promptStudioDesktop);
  const workbenches = projectTabs
    ? startDesktopProjectWorkbenches(projectTabs.controller, storage)
    : startBrowserWorkbench(storage);
  const stopDesktopCommands = connectDesktopCommands(window.promptStudioDesktop, workbenches.getActive);
  if (stopDesktopCommands) window.addEventListener("pagehide", stopDesktopCommands, { once: true });
  // E2E specs and the packaged launch benchmark drive the visible workbench.
  Object.defineProperty(window, "__pstdioDashboardWorkbench", { configurable: true, get: workbenches.getActive });

  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    root.unmount();
    workbenches.dispose();
  });
  root.render(
    <StrictMode>
      <HostStorageProvider storage={storage}>
        <SyncProvider>
          {projectTabs ? (
            <DesktopProjectWorkbenches
              controller={projectTabs.controller}
              lifecycle={desktopLifecycle}
              platform={projectTabs.platform}
              storage={storage}
            />
          ) : (
            <DashboardWorkbenchView
              panelControlsPlacement="nav"
              workbench={workbenches.getActive()!}
              storage={storage}
              titleBar={
                desktopLifecycle && (
                  <>
                    <DesktopStartupAppearance bridge={desktopLifecycle} />
                    <DesktopQuitConfirmation bridge={desktopLifecycle} />
                  </>
                )
              }
            />
          )}
        </SyncProvider>
      </HostStorageProvider>
    </StrictMode>,
  );
};

const startBrowserWorkbench = (storage: WorkbenchStorageLike | undefined) => {
  // Send native layout writes before a following Quit request can close the renderer.
  const workbench = createDashboardWorkbench({ storage, layoutDebounceMs: storage ? 0 : undefined });
  return { getActive: () => workbench, dispose: () => void workbench.dispose() };
};

// Each visited desktop tab keeps its own workbench. They share the window's navigation,
// saved project selection, and performance monitoring.
const startDesktopProjectWorkbenches = (
  controller: DesktopProjectTabsController,
  storage: WorkbenchStorageLike | undefined,
) => {
  const pageLocationBrowser = createDashboardPageLocationBrowser(window);
  const persistence = createDashboardProjectSelectionPersistence({
    namespace: dashboardWorkbenchStorageNamespace,
    storage,
  });
  const performance = createPerformanceMonitoring();
  controller.start({
    persistence,
    projectId: readPageUrlProjectId(pageLocationBrowser.current().url) ?? persistence.getSelectedProjectId(),
    createWorkbench: (projectId, active) =>
      createDashboardWorkbench({
        active,
        projectId,
        projectTabs: controller,
        pageLocationBrowser,
        performance,
        storage,
        // Send native layout writes before a following Quit request can close the renderer.
        layoutDebounceMs: 0,
      }),
  });
  const connection = controller.connect();
  return {
    getActive: controller.getActiveWorkbench,
    dispose: () => {
      connection.dispose();
      controller.dispose();
      performance.dispose();
    },
  };
};

void renderDashboard();
