import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbenchCore, type WorkflowStatus } from "../../core";
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
    actions: ["archive_all"],
  },
];

const severalProvidersWorkbench = createWorkbenchCore();
severalProvidersWorkbench.statuses.registerStatusSet({
  id: "planner.ticket",
  title: "Ticket statuses",
  actions: [{ id: "archive_all", label: "Archive all", icon: "archive" }],
  query: async () => ticketStatuses,
  save: async (statuses) => statuses,
});
severalProvidersWorkbench.statuses.registerStatusSet({
  id: "deploy.release",
  title: "Release statuses",
  query: async () => [{ id: "ready", label: "Ready", color: "blue", sortOrder: 100 }],
});

const loadingWorkbench = createWorkbenchCore();
loadingWorkbench.statuses.registerStatusSet({
  id: "slow",
  title: "Loading provider",
  query: () => new Promise<WorkflowStatus[]>(() => {}),
});

const cachedWorkbench = createWorkbenchCore();
cachedWorkbench.statuses.registerStatusSet({
  id: "cached",
  title: "Already loaded provider",
  query: async () => ticketStatuses,
  save: async (statuses) => statuses,
});

const saveFailureWorkbench = createWorkbenchCore();
saveFailureWorkbench.statuses.registerStatusSet({
  id: "failing",
  title: "Save failure",
  query: async () => ticketStatuses,
  save: async () => {
    throw new Error("The provider rejected this status order.");
  },
});

const isolatedProvidersWorkbench = createWorkbenchCore();
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
  title: "pstdio-workbench/WorkflowStatusSettings",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const StatusesFrame = (props: { workbench: ReturnType<typeof createWorkbenchCore> }) => {
  const { workbench } = props;
  return (
    <Box minH="100dvh" bg="bg">
      <WorkflowStatusSettings workbench={workbench} />
    </Box>
  );
};

export const SeveralProvidersAndReadOnly: Story = {
  render: () => <StatusesFrame workbench={severalProvidersWorkbench} />,
};

export const Loading: Story = {
  render: () => <StatusesFrame workbench={loadingWorkbench} />,
};

export const AlreadyLoaded: Story = {
  loaders: [async () => await cachedWorkbench.statuses.load("cached")],
  render: () => <StatusesFrame workbench={cachedWorkbench} />,
};

export const SaveFailure: Story = {
  render: () => <StatusesFrame workbench={saveFailureWorkbench} />,
};

export const ProviderIsolation: Story = {
  render: () => <StatusesFrame workbench={isolatedProvidersWorkbench} />,
};
