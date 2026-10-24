import type { Meta, StoryObj } from "@storybook/react";
import { autoBuildStoryConfiguration } from "./auto-build.story-fixture";
import { AutoBuildButton } from "./auto-build-button";

const meta: Meta<typeof AutoBuildButton> = {
  title: "Extensions/Planner/Auto Build Status",
  component: AutoBuildButton,
  args: {
    enabled: false,
    sessions: [],
    running: 0,
    capacity: 2,
    configuration: autoBuildStoryConfiguration,
    onPause: async () => true,
    onResume: async () => true,
    onOpenSession: () => {},
    t: (_key, fallback) => fallback ?? _key,
  },
};
export default meta;
type Story = StoryObj<typeof AutoBuildButton>;
export const Off: Story = {};
export const StoppedWithLiveSessions: Story = {
  args: {
    enabled: false,
    running: 1,
    supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "in_progress" },
  },
};
export const Waiting: Story = { args: { enabled: true } };
export const Starting: Story = { args: { enabled: true, starting: true } };
export const ExistingWork: Story = {
  args: {
    enabled: true,
    matchingTicketCount: 1,
    readyTicketCount: 0,
    waitingTickets: [{ id: "ticket", ticket: "P-1", title: "Greeting", reason: "existing-attempt", dependencyIds: [] }],
  },
};
export const ReadyAlongsideExistingWork: Story = {
  args: { ...ExistingWork.args, matchingTicketCount: 2, readyTicketCount: 1 },
};
export const NoMatchingTickets: Story = { args: { enabled: true, matchingTicketCount: 0 } };
export const Running: Story = {
  args: {
    enabled: true,
    running: 2,
    supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "completed" },
    sessions: [
      { id: "ticket", title: "PC-103 · Validate worker recovery", status: "in_progress" },
      { id: "ticket-2", title: "PC-109 · Launch instances from pstdio", status: "in_progress" },
    ],
  },
};
export const Sleeping: Story = {
  args: { enabled: true, supervisor: { id: "supervisor", title: "Auto Build supervisor", status: "completed" } },
};
export const Completed: Story = {
  args: {
    enabled: true,
    completed: true,
    supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "completed" },
  },
};
export const Queued: Story = {
  args: { enabled: true, supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "queued" } },
};
export const SessionStatuses: Story = {
  args: {
    enabled: true,
    supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "in_progress" },
    sessions: ["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"].map(
      (status) => ({ id: status, title: `Ticket · ${status.replaceAll("_", " ")}`, status }),
    ),
  },
};
export const Failed: Story = {
  args: {
    enabled: true,
    supervisor: { id: "supervisor", title: "Auto Build supervisor", status: "failed" },
  },
};
export const WakeFailed: Story = { args: { error: "Agent unavailable" } };
export const Stuck: Story = {
  args: {
    enabled: true,
    stuck: true,
    supervisor: { id: "supervisor", title: "Auto Build supervisor", status: "completed" },
  },
};

export const Paused: Story = { args: { ...Running.args, enabled: false, paused: true } };
export const ManyRunningAgents: Story = {
  args: {
    ...Running.args,
    running: 40,
    capacity: 40,
    sessions: Array.from({ length: 40 }, (_, i) => ({
      id: `agent-${i}`,
      title: `P-${i + 1} · Implement shared tools`,
      status: "in_progress",
    })),
  },
};
export const PausedWithManyAgents: Story = { args: { ...ManyRunningAgents.args, enabled: false, paused: true } };
export const ReviewRequests: Story = {
  args: {
    ...ManyRunningAgents.args,
    reviewRequests: [
      {
        id: "release-decision",
        ticketId: "ticket",
        title: "P-1 · Choose the release scope",
        instructions: "Which tool should the builder finish first?",
        request: { kind: "task" },
        requestedAt: "2026-10-22T12:00:00Z",
        requestedBy: { type: "agent", id: "builder", displayName: "Builder" },
        context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: null, relatedSessionId: null },
        state: "open",
        outcome: null,
        outcomeText: null,
      },
    ],
    onOpenRequest: () => {},
  },
};
