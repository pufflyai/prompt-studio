import "@pstdio/ui/style.css";

import { PstdioApiError } from "@pstdio/sdk/client";
import { HostStorageProvider } from "@pstdio/ui";
import { Workbench, WorkbenchIcon, WorkbenchThemeProvider } from "@pstdio/workbench/react";
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
import { DesktopProjectTabs } from "@/modules/projects/components/desktop-project-tabs";
import { openDashboardSidePanel } from "@/modules/sessions/bubble/open-side-panel";
import { createDashboardParamFieldRenderer } from "@/shared/command-params/dashboard-param-field";
import { BrowserSignInRequired } from "@/shared/components/browser-sign-in-required";

import { DashboardHostPreferences } from "./shared/workbench/dashboard-host-preferences";
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
      <HostStorageProvider storage={storage}>
        <SyncProvider>
          <Workbench
            panelControlsPlacement={projectTabs ? "host" : "nav"}
            workbench={dashboardWorkbench}
            themeStorage={storage}
            titleBar={
              <>
                <DashboardHostPreferences workbench={dashboardWorkbench} />
                {projectTabs && <DesktopProjectTabs workbench={dashboardWorkbench} {...projectTabs} />}
                {desktopLifecycle && <DesktopStartupAppearance bridge={desktopLifecycle} />}
                {desktopLifecycle && <DesktopQuitConfirmation bridge={desktopLifecycle} />}
              </>
            }
            renderParamField={renderParamField}
            sidePanelBubbleIcon={<WorkbenchIcon name="message-circle" size={20} />}
            onOpenSidePanel={() => void openDashboardSidePanel(dashboardWorkbench)}
          />
        </SyncProvider>
      </HostStorageProvider>
    </StrictMode>,
  );
};

void renderDashboard();
