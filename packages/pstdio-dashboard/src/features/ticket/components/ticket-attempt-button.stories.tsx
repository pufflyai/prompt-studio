import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { type ComponentProps, useState } from "react";
import { agentModelKeys } from "@/features/agents/hooks/use-agent-models";
import { agentKeys } from "@/features/agents/hooks/use-agents";
import { projectKeys } from "@/features/project/hooks/keys";
import { repoBranchKeys } from "@/features/project/hooks/use-repo-branches";
import { WorkspaceProvider } from "@/features/workspaces/state";
import { TicketAttemptButton } from "./ticket-attempt-button";

const PROJECT_ID = "project-ticket-attempt-story";
const REPO_ID = "repo-ticket-attempt-story";

const createTicketAttemptButtonQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });

  queryClient.setQueryData(agentKeys.list(), [
    {
      id: "opencode",
      name: "Opencode",
      availability: { type: "INSTALLED" },
      capabilities: [],
      isDefault: true,
    },
  ]);

  queryClient.setQueryData(agentModelKeys.byAgent("opencode"), [{ id: "o3" }]);

  queryClient.setQueryData(projectKeys.repositories(PROJECT_ID), [
    {
      id: REPO_ID,
      name: "schub",
      displayName: "Schub",
      path: "/repos/schub",
      createdAt: "2026-02-20T00:00:00.000Z",
      updatedAt: "2026-02-20T00:00:00.000Z",
    },
  ]);

  queryClient.setQueryData(repoBranchKeys.byRepo(REPO_ID), [
    {
      name: "main",
      isCurrent: true,
      isRemote: false,
      lastCommitDate: "2026-02-20T00:00:00.000Z",
    },
    {
      name: "feature/attempt-button",
      isCurrent: false,
      isRemote: false,
      lastCommitDate: "2026-02-20T00:00:00.000Z",
    },
  ]);

  return queryClient;
};

const createTicketAttemptButtonRouter = (props: ComponentProps<typeof TicketAttemptButton>) => {
  const rootRoute = createRootRoute({
    component: () => (
      <WorkspaceProvider>
        <Outlet />
      </WorkspaceProvider>
    ),
  });

  const projectsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "projects",
    component: Outlet,
  });

  const projectRoute = createRoute({
    getParentRoute: () => projectsRoute,
    path: "$projectId",
    component: Outlet,
  });

  const ticketsRoute = createRoute({
    getParentRoute: () => projectRoute,
    path: "tickets",
    component: Outlet,
  });

  const ticketRoute = createRoute({
    getParentRoute: () => ticketsRoute,
    path: "$ticketShorthand",
    component: () => (
      <Box p="sm">
        <TicketAttemptButton {...props} />
      </Box>
    ),
  });

  const routeTree = rootRoute.addChildren([
    projectsRoute.addChildren([projectRoute.addChildren([ticketsRoute.addChildren([ticketRoute])])]),
  ]);

  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [`/projects/${PROJECT_ID}/tickets/T001`] }),
  });
};

const TicketAttemptButtonStory = (props: ComponentProps<typeof TicketAttemptButton>) => {
  const [queryClient] = useState(createTicketAttemptButtonQueryClient);
  const router = createTicketAttemptButtonRouter(props);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

const meta = {
  title: "Ticket/TicketAttemptButton",
  component: TicketAttemptButton,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof TicketAttemptButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RunFirstAttempt: Story = {
  render: (args) => <TicketAttemptButtonStory {...args} />,
  args: {
    attemptCount: 0,
    additions: 0,
    deletions: 0,
    onRunAttempt: async () => true,
  },
};

export const AttemptSummaryWithDiff: Story = {
  render: (args) => <TicketAttemptButtonStory {...args} />,
  args: {
    attemptCount: 3,
    additions: 2,
    deletions: 1,
    onRunAttempt: async () => true,
  },
};

export const RunningAttempt: Story = {
  render: (args) => <TicketAttemptButtonStory {...args} />,
  args: {
    attemptCount: 1,
    additions: 12,
    deletions: 4,
    isRunning: true,
    onRunAttempt: async () => true,
  },
};
