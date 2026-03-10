import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { type ComponentProps, useEffect, useState } from "react";
import { seedCollection } from "@/features/sync/seed-collections";
import { WorkspaceProvider } from "@/features/workspaces/state";
import { TicketAttemptButton } from "./ticket-attempt-button";

const PROJECT_ID = "project-ticket-attempt-story";
const REPO_ID = "repo-ticket-attempt-story";

const seedStoryData = () => {
  seedCollection("repos", [
    {
      id: REPO_ID,
      name: "schub",
      display_name: "Schub",
      path: "/repos/schub",
      created_at: "2026-02-20T00:00:00.000Z",
      updated_at: "2026-02-20T00:00:00.000Z",
    },
  ]);

  seedCollection("project_repos", [
    {
      id: `pr-${REPO_ID}`,
      project_id: PROJECT_ID,
      repo_id: REPO_ID,
    },
  ]);
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
  const [ready, setReady] = useState(false);
  const router = createTicketAttemptButtonRouter(props);

  useEffect(() => {
    seedStoryData();
    setReady(true);
  }, []);

  if (!ready) return null;

  return <RouterProvider router={router} />;
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
