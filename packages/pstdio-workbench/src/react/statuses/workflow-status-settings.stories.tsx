import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
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

const statusStorySource = (setup: string) => `import { Box } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import {
  WorkbenchThemeProvider,
  WorkflowStatusSettings,
} from "@pstdio/workbench/react";

const workbench = createWorkbench();
${setup}

export const App = () => (
  <WorkbenchThemeProvider>
    <Box minH="100dvh" bg="bg">
      <WorkflowStatusSettings workbench={workbench} />
    </Box>
  </WorkbenchThemeProvider>
);`;

const statusSourceParameters = (setup: string) => ({
  docs: { source: { code: statusStorySource(setup), language: "tsx", type: "code" } },
});
isolatedProvidersWorkbench.statuses.registerStatusSet({
  id: "healthy",
  title: "Healthy provider",
  query: async () => ticketStatuses,
  save: async (statuses) => statuses,
});

const meta = {
  title: "pstdio-workbench/Reference/Core API/Workflow status editor",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A workflow status set owns its query, optional save operation, and optional actions. Providers load and fail independently so one extension cannot break another provider's settings.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

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
  parameters: statusSourceParameters(`workbench.statuses.registerStatusSet({
  id: "planner.ticket",
  title: "Ticket statuses",
  actions: [{ id: "archive_all", label: "Archive all", icon: "archive" }],
  query: async () => [
    { id: "backlog", label: "Backlog", color: "gray", sortOrder: 100, isDefault: true },
    { id: "done", label: "Done", color: "green", sortOrder: 200, actions: ["archive_all"] },
  ],
  save: async (statuses) => statuses,
});
workbench.statuses.registerStatusSet({
  id: "deploy.release",
  title: "Release statuses",
  query: async () => [
    { id: "ready", label: "Ready", color: "blue", sortOrder: 100 },
  ],
});`),
  render: () => <StatusesFrame workbench={severalProvidersWorkbench} />,
};

export const Loading: Story = {
  parameters: statusSourceParameters(`workbench.statuses.registerStatusSet({
  id: "slow",
  title: "Loading provider",
  query: () => new Promise(() => {}),
});`),
  render: () => <StatusesFrame workbench={loadingWorkbench} />,
};

export const AlreadyLoaded: Story = {
  parameters: statusSourceParameters(`workbench.statuses.registerStatusSet({
  id: "cached",
  title: "Already loaded provider",
  query: async () => [
    { id: "backlog", label: "Backlog", color: "gray", sortOrder: 100, isDefault: true },
    { id: "done", label: "Done", color: "green", sortOrder: 200 },
  ],
  save: async (statuses) => statuses,
});
await workbench.statuses.load("cached");`),
  loaders: [async () => await cachedWorkbench.statuses.load("cached")],
  render: () => <StatusesFrame workbench={cachedWorkbench} />,
};

export const SaveFailure: Story = {
  parameters: statusSourceParameters(`workbench.statuses.registerStatusSet({
  id: "failing",
  title: "Save failure",
  query: async () => [
    { id: "backlog", label: "Backlog", color: "gray", sortOrder: 100, isDefault: true },
    { id: "done", label: "Done", color: "green", sortOrder: 200 },
  ],
  save: async () => {
    throw new Error("The provider rejected this status order.");
  },
});`),
  render: () => <StatusesFrame workbench={saveFailureWorkbench} />,
};

export const ProviderIsolation: Story = {
  parameters: statusSourceParameters(`workbench.statuses.registerStatusSet({
  id: "broken",
  title: "Unavailable provider",
  query: async () => {
    throw new Error("This provider is unavailable.");
  },
});
workbench.statuses.registerStatusSet({
  id: "healthy",
  title: "Healthy provider",
  query: async () => [
    { id: "backlog", label: "Backlog", color: "gray", sortOrder: 100, isDefault: true },
    { id: "done", label: "Done", color: "green", sortOrder: 200 },
  ],
  save: async (statuses) => statuses,
});`),
  render: () => <StatusesFrame workbench={isolatedProvidersWorkbench} />,
};
