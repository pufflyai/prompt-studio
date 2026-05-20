import "@pstdio/ui/style.css";

import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Workbench } from "pstdio-workbench/react";
import { createRoot } from "react-dom/client";
import { getAllCollections, getWriter, type SyncedTable } from "@/lib/sync/collections";
import { createDashboardWorkbench } from "@/services/workbench/create-dashboard-workbench";
import {
  sessionResource,
  settingsSectionResource,
  ticketResource,
  workspaceResource,
} from "@/services/workbench/resources/resource-kinds";

const projectId = "project-1";
const queryClient = new QueryClient();
const workbench = createDashboardWorkbench(projectId);

declare global {
  interface Window {
    __dashboardWorkbenchSmoke?: {
      openTicket: () => Promise<unknown>;
      openWorkspace: () => Promise<unknown>;
      openSession: () => Promise<unknown>;
      openSettings: () => Promise<unknown>;
      attachSession: () => void;
      bubbleSession: () => void;
    };
  }
}

const writeRows = (table: SyncedTable, rows: Record<string, unknown>[]) => {
  getWriter(table)?.truncateAndWrite(rows.map((row) => ({ id: String(row.id), ...row })));
};

getAllCollections();
setTimeout(() => {
  writeRows("projects", [{ id: projectId, name: "Smoke project" }]);
  writeRows("ticket_statuses", [{ id: "status-1", project_id: projectId, name: "Ready", color: "green" }]);
  writeRows("tickets", [
    {
      id: "ticket-1",
      project_id: projectId,
      shorthand: "PS-298",
      display_title: "Dashboard workbench smoke ticket",
      status_id: "status-1",
      user_prompt: "Prove the workbench shell renders ticket details.",
    },
  ]);
  writeRows("workspaces", [
    {
      id: "workspace-1",
      project_id: projectId,
      workspace_shorthand: "PS-298_A1",
      name: "Smoke attempt workspace",
      branch: "feature/dashboard-workbench",
    },
  ]);
  writeRows("sessions", [
    { id: "session-1", project_id: projectId, title: "Smoke session", status: "completed", agent: "opencode" },
  ]);
  writeRows("agent_configs", [{ id: "agent-1", agent_id: "opencode", is_default: true }]);
}, 0);

window.__dashboardWorkbenchSmoke = {
  openTicket: () => workbench.resources.openResource(ticketResource("PS-298", "Dashboard workbench smoke ticket")),
  openWorkspace: () =>
    workbench.resources.openResource(workspaceResource("PS-298_A1", { label: "Smoke attempt workspace" })),
  openSession: () => workbench.resources.openResource(sessionResource("session-1", "Smoke session")),
  openSettings: () => workbench.resources.openResource(settingsSectionResource("agents")),
  attachSession: () => workbench.sessionPanel.setMode("attached"),
  bubbleSession: () => workbench.sessionPanel.setMode("bubble"),
};

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ChakraProvider value={psTheme}>
      <div data-dashboard-smoke-ready="true" />
      <Workbench workbench={workbench} />
    </ChakraProvider>
  </QueryClientProvider>,
);
