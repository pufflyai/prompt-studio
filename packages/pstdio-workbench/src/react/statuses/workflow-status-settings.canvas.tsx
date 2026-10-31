import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useEffect, useState } from "react";
import { createWorkbench, type WorkflowStatus } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkflowStatusSettings } from "./workflow-status-settings";

const ticketStatuses: WorkflowStatus[] = [
  {
    id: "backlog",
    label: "Backlog",
    color: "gray",
    sortOrder: 100,
    isDefault: true,
  },
  {
    id: "done",
    label: "Done",
    color: "green",
    sortOrder: 200,
  },
];
const actionableTicketStatuses = ticketStatuses.map((status) =>
  status.id === "done" ? { ...status, actions: ["archive_all"] } : status,
);
const severalProvidersWorkbench = createWorkbench();
severalProvidersWorkbench.statuses.registerStatusSet({
  id: "planner.ticket",
  title: "Ticket statuses",
  actions: [{ id: "archive_all", label: "Archive all", icon: "archive" }],
  query: async () => actionableTicketStatuses,
  save: async (statuses) => statuses,
});
severalProvidersWorkbench.statuses.registerStatusSet({
  id: "deploy.release",
  title: "Release statuses",
  query: async () => [{ id: "ready", label: "Ready", color: "blue", sortOrder: 100 }],
});
const loadingWorkbench = createWorkbench();
loadingWorkbench.statuses.registerStatusSet({
  id: "slow",
  title: "Loading provider",
  query: () => new Promise<WorkflowStatus[]>(() => {}),
});
const cachedWorkbench = createWorkbench();
cachedWorkbench.statuses.registerStatusSet({
  id: "cached",
  title: "Already loaded provider",
  query: async () => ticketStatuses,
  save: async (statuses) => statuses,
});
const saveFailureWorkbench = createWorkbench();
saveFailureWorkbench.statuses.registerStatusSet({
  id: "failing",
  title: "Save failure",
  query: async () => ticketStatuses,
  save: async () => {
    throw new Error("The provider rejected this status order.");
  },
});
const isolatedProvidersWorkbench = createWorkbench();
isolatedProvidersWorkbench.statuses.registerStatusSet({
  id: "broken",
  title: "Unavailable provider",
  query: async () => {
    throw new Error("This provider is unavailable.");
  },
});
isolatedProvidersWorkbench.statuses.registerStatusSet({
  id: "healthy",
  title: "Healthy provider",
  query: async () => ticketStatuses,
  save: async (statuses) => statuses,
});
const meta = {
  title: "pstdio-workbench/Reference/Core API/Workflow status editor",
  description:
    "A workflow status set owns its query, optional save operation, and optional actions. Providers load and fail independently so one extension cannot break another provider's settings.",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;
type Story = CanvasFrame<typeof meta>;
const StatusesFrame = (props: { workbench: ReturnType<typeof createWorkbench> }) => {
  const { workbench } = props;
  return (
    <WorkbenchThemeProvider>
      <Box minH="100dvh" bg="bg">
        <WorkflowStatusSettings workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
export const SeveralProvidersAndReadOnly: Story = {
  id: "pstdio-workbench-reference-core-api-workflow-status-editor--several-providers-and-read-only",
  render: () => <StatusesFrame workbench={severalProvidersWorkbench} />,
};
export const Loading: Story = {
  id: "pstdio-workbench-reference-core-api-workflow-status-editor--loading",
  render: () => <StatusesFrame workbench={loadingWorkbench} />,
};
// Loads the cached statuses before the editor mounts, so the editor starts with loaded data.
const AlreadyLoadedFrame = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void cachedWorkbench.statuses.load("cached").then(() => setLoaded(true));
  }, []);
  return loaded ? <StatusesFrame workbench={cachedWorkbench} /> : null;
};
export const AlreadyLoaded: Story = {
  id: "pstdio-workbench-reference-core-api-workflow-status-editor--already-loaded",
  render: () => <AlreadyLoadedFrame />,
};
export const SaveFailure: Story = {
  id: "pstdio-workbench-reference-core-api-workflow-status-editor--save-failure",
  render: () => <StatusesFrame workbench={saveFailureWorkbench} />,
};
export const ProviderIsolation: Story = {
  id: "pstdio-workbench-reference-core-api-workflow-status-editor--provider-isolation",
  render: () => <StatusesFrame workbench={isolatedProvidersWorkbench} />,
};
