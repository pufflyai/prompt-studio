import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { type ComponentProps, useState } from "react";
import { autoBuildStoryConfiguration } from "./auto-build.story-fixture";
import { AutoBuildButton } from "./auto-build-button";

// Pause, resume and stop change the example's own state, so each frame can be tried.
const InteractiveAutoBuildButton = (props: ComponentProps<typeof AutoBuildButton>) => {
  const [state, setState] = useState(props);
  const update = (change: Partial<ComponentProps<typeof AutoBuildButton>>) => {
    setState((current) => ({ ...current, ...change }));
    return Promise.resolve(true);
  };
  return (
    <AutoBuildButton
      {...state}
      onPause={() => update({ enabled: false, paused: true })}
      onResume={() => update({ enabled: true, paused: false })}
      onStop={() => update({ enabled: false, paused: false, running: 0, sessions: [], supervisor: null })}
    />
  );
};

const meta: CanvasMeta<typeof AutoBuildButton> = {
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
    onStop: async () => true,
    onOpenSession: () => {},
    t: (_key, fallback) => fallback ?? _key,
  },
  render: (args) => <InteractiveAutoBuildButton {...args} />,
};
export default meta;
type Story = CanvasFrame<typeof AutoBuildButton>;
export const Off: Story = {
  id: "extensions-planner-auto-build-status--off",
};
export const StoppedWithLiveSessions: Story = {
  id: "extensions-planner-auto-build-status--stopped-with-live-sessions",
  args: {
    enabled: false,
    running: 1,
    supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "in_progress" },
  },
};
export const Waiting: Story = {
  id: "extensions-planner-auto-build-status--waiting",
  args: { enabled: true },
};
export const Starting: Story = {
  id: "extensions-planner-auto-build-status--starting",
  args: { enabled: true, starting: true },
};
export const ExistingWork: Story = {
  id: "extensions-planner-auto-build-status--existing-work",
  args: {
    enabled: true,
    matchingTicketCount: 1,
    readyTicketCount: 0,
    waitingTickets: [{ id: "ticket", ticket: "P-1", title: "Greeting", reason: "existing-attempt", dependencyIds: [] }],
  },
};
export const ReadyAlongsideExistingWork: Story = {
  id: "extensions-planner-auto-build-status--ready-alongside-existing-work",
  args: { ...ExistingWork.args, matchingTicketCount: 2, readyTicketCount: 1 },
};
export const NoMatchingTickets: Story = {
  id: "extensions-planner-auto-build-status--no-matching-tickets",
  args: { enabled: true, matchingTicketCount: 0 },
};
export const Running: Story = {
  id: "extensions-planner-auto-build-status--running",
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
  id: "extensions-planner-auto-build-status--sleeping",
  args: { enabled: true, supervisor: { id: "supervisor", title: "Auto Build supervisor", status: "completed" } },
};
export const Completed: Story = {
  id: "extensions-planner-auto-build-status--completed",
  args: {
    enabled: true,
    completed: true,
    supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "completed" },
  },
};
export const Queued: Story = {
  id: "extensions-planner-auto-build-status--queued",
  args: { enabled: true, supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "queued" } },
};
export const SessionStatuses: Story = {
  id: "extensions-planner-auto-build-status--session-statuses",
  args: {
    enabled: true,
    supervisor: { id: "supervisor", title: "Finish PocketCoder 1.0", status: "in_progress" },
    sessions: ["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"].map(
      (status) => ({ id: status, title: `Ticket · ${status.replaceAll("_", " ")}`, status }),
    ),
  },
};
export const Failed: Story = {
  id: "extensions-planner-auto-build-status--failed",
  args: {
    enabled: true,
    supervisor: { id: "supervisor", title: "Auto Build supervisor", status: "failed" },
  },
};
export const WakeFailed: Story = {
  id: "extensions-planner-auto-build-status--wake-failed",
  args: { error: "Agent unavailable" },
};
export const Stuck: Story = {
  id: "extensions-planner-auto-build-status--stuck",
  args: {
    enabled: true,
    stuck: true,
    supervisor: { id: "supervisor", title: "Auto Build supervisor", status: "completed" },
  },
};
export const Paused: Story = {
  id: "extensions-planner-auto-build-status--paused",
  args: { ...Running.args, enabled: false, paused: true },
};
export const ManyRunningAgents: Story = {
  id: "extensions-planner-auto-build-status--many-running-agents",
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
export const PausedWithManyAgents: Story = {
  id: "extensions-planner-auto-build-status--paused-with-many-agents",
  args: { ...ManyRunningAgents.args, enabled: false, paused: true },
};
export const ReviewRequests: Story = {
  id: "extensions-planner-auto-build-status--review-requests",
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
