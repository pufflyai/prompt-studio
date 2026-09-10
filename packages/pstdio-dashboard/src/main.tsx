import "@pstdio/ui/style.css";

import { Workbench } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { connectDesktopCommands } from "@/lib/desktop-commands";
import { createDesktopProjectTabs } from "@/lib/desktop-project-tabs-bridge";
import { createDesktopWorkbenchStorage } from "@/lib/desktop-workbench-storage";
import { dashboardQueryClient } from "@/lib/query-client";
import { SyncProvider } from "@/lib/sync/sync-provider";
import { DesktopProjectTabs } from "@/modules/projects/components/desktop-project-tabs";
import { openDashboardSidePanel } from "@/modules/sessions/bubble/open-side-panel";
import { createDashboardParamFieldRenderer } from "@/shared/command-params/dashboard-param-field";

import { createDashboardWorkbench } from "./workbench";
import "./i18n";

const renderDashboard = async () => {
  const storage = await createDesktopWorkbenchStorage(window.promptStudioDesktop);
  const projectTabs = await createDesktopProjectTabs(window.promptStudioDesktop);
  const dashboardWorkbench = createDashboardWorkbench({ storage, projectTabs: projectTabs?.controller });
  const stopDesktopCommands = connectDesktopCommands(window.promptStudioDesktop, dashboardWorkbench);
  if (stopDesktopCommands) window.addEventListener("pagehide", stopDesktopCommands, { once: true });
  (window as unknown as Record<string, unknown>).__pstdioDashboardWorkbench = dashboardWorkbench;
  const renderParamField = createDashboardParamFieldRenderer(dashboardWorkbench);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={dashboardQueryClient}>
        <SyncProvider>
          <Workbench
            workbench={dashboardWorkbench}
            titleBar={projectTabs && <DesktopProjectTabs workbench={dashboardWorkbench} {...projectTabs} />}
            renderParamField={renderParamField}
            onOpenSidePanel={() => void openDashboardSidePanel(dashboardWorkbench)}
          />
        </SyncProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
};

void renderDashboard();
