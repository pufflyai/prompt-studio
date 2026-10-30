import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { ReviewRequestView } from "../../data/review-request-types";
import type { PlanRow } from "../contracts";
import { ticketTarget } from "../planner";
import { GraphCard } from "./graph-card";
import { cardReviewRequest, EditableCardPreview } from "./graph-card.story-fixture";

const row: PlanRow = {
  id: "shared-card",
  shorthand: "P-1",
  title: "Use the same card on both boards",
  status: { id: "todo", name: "Todo", icon: "circle", color: "gray" },
  state: "not-started",
  done: false,
  trackId: null,
  deadlineId: null,
  step: 1,
  ancestors: [],
  dependsOn: [],
  blocks: [],
  laterDependencies: [],
  flags: [],
  tagIds: [],
  requests: [],
  requestErrors: [],
  instructions: "",
  target: ticketTarget({ id: "shared-card", shorthand: "P-1", title: "Use the same card on both boards" }),
};
const meta: CanvasMeta<typeof GraphCard> = {
  title: "Extensions/Planner/Timeline card",
  component: GraphCard,
  render: (args) => <EditableCardPreview {...args} />,
  decorators: [
    (Story) => (
      <Box position="relative" minH="300px">
        <Story />
      </Box>
    ),
  ],
  args: {
    row,
    x: 0,
    y: 0,
    dropBefore: false,
    onSelect: () => {},
    onDragStart: () => {},
    onDragOver: () => {},
    onDrop: () => {},
  },
};
export default meta;
type Story = CanvasVariant<typeof GraphCard>;
export const Available: Story = {
  id: "extensions-planner-timeline-card--available",
};
export const WaitingForPrerequisite: Story = {
  id: "extensions-planner-timeline-card--waiting-for-prerequisite",
  args: { row: { ...row, dependsOn: [{ id: "prerequisite", shorthand: "P-2", done: false }], flags: ["waiting"] } },
};
export const Blocked: Story = {
  id: "extensions-planner-timeline-card--blocked",
  args: { row: { ...row, state: "blocked", flags: ["blocked"], blockedReason: "Missing credentials" } },
};
export const Selected: Story = {
  id: "extensions-planner-timeline-card--selected",
  args: { relation: "selected" },
};
export const CustomStatus: Story = {
  id: "extensions-planner-timeline-card--custom-status",
  args: { row: { ...row, status: { id: "queued", name: "Queued", icon: "flag", color: "purple" } } },
};
export const ReviewRequested: Story = {
  id: "extensions-planner-timeline-card--review-requested",
  args: { row: { ...row, flags: ["human-needed"], state: "await-input", requests: [cardReviewRequest] } },
};
export const ReviewAnswered: Story = {
  id: "extensions-planner-timeline-card--review-answered",
  args: { row: { ...row, state: "input-received", requests: [{ ...cardReviewRequest, state: "answered" }] } },
};
export const AllProperties: Story = {
  id: "extensions-planner-timeline-card--all-properties",
  render: (args) => (
    <EditableCardPreview {...args} displayProperties={["id", "status", "type", "workspace", "needsAttention"]} />
  ),
};
const request: ReviewRequestView = {
  id: "review",
  ticketId: row.id,
  title: "Review the proposal",
  instructions: "Confirm the scenarios.",
  request: { kind: "task" },
  requestedAt: "2026-10-15T09:00:00.000Z",
  requestedBy: { type: "agent", id: "agent", displayName: "Agent" },
  context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: "session", relatedSessionId: null },
  state: "open",
  outcome: null,
  outcomeText: null,
};
export const MultipleRequests: Story = {
  id: "extensions-planner-timeline-card--multiple-requests",
  args: {
    row: { ...row, requests: [request, { ...request, id: "second" }], state: "await-input" },
    onOpenRequests: () => {},
  },
};
export const AllRequestsResolved: Story = {
  id: "extensions-planner-timeline-card--all-requests-resolved",
  args: {
    row: {
      ...row,
      requests: [
        {
          ...request,
          state: "answered",
          outcomeText: "Completion confirmed",
          outcome: {
            kind: "answered",
            at: "2026-10-15T09:10:00.000Z",
            by: { type: "human", id: "person", displayName: "Person" },
            response: { confirmed: true },
          },
        },
      ],
    },
    onOpenRequests: () => {},
  },
};
export const FullTitle: Story = {
  id: "extensions-planner-timeline-card--full-title",
  args: {
    row: {
      ...row,
      title:
        "A longer ticket title keeps the native Kanban card's wrapping and full height, so dependent cards and milestones stay below it.",
    },
  },
};
