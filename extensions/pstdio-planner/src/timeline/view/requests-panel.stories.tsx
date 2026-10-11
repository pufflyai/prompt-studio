import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReviewRequestView } from "../../data/review-request-types";
import type { PlanRow } from "../contracts";
import { ticketTarget } from "../planner";
import { RequestsPanel } from "./requests-panel";

const person = { type: "human" as const, id: "person", displayName: "Human" };
const agent = { type: "agent" as const, id: "agent", displayName: "Agent" };
const context = { reason: null, workspaceId: null, attemptRevision: null, sessionId: "chat", relatedSessionId: null };

const task: ReviewRequestView = {
  id: "task",
  ticketId: "ticket",
  title: "Check the preview",
  instructions: "Open the preview and confirm its layout.",
  request: { kind: "task" },
  requestedAt: "2026-10-10T09:00:00.000Z",
  requestedBy: agent,
  context,
  state: "open",
  outcome: null,
  outcomeText: null,
};

const decision: ReviewRequestView = {
  ...task,
  id: "decision",
  title: "Choose the release scope",
  instructions: "Choose the scope and describe any limits.",
  request: {
    kind: "decision",
    questions: [
      {
        id: "scope",
        label: "Release scope",
        required: true,
        input: {
          kind: "single-choice",
          options: [
            { id: "preview", label: "Preview" },
            { id: "full", label: "Full release" },
          ],
        },
      },
      {
        id: "platforms",
        label: "Platforms",
        required: false,
        input: {
          kind: "multiple-choice",
          options: [
            { id: "mac", label: "macOS" },
            { id: "windows", label: "Windows" },
          ],
        },
      },
      { id: "limits", label: "Limits", required: true, input: { kind: "text" } },
    ],
  },
};

const handoff: ReviewRequestView = {
  ...task,
  id: "handoff",
  title: "PS-32_A1 revision 2 is approved.",
  instructions: "Select, merge, or otherwise handle the approved workspace.",
  request: {
    kind: "decision",
    questions: [{ id: "result", label: "Decision and completed action", required: true, input: { kind: "text" } }],
  },
  context: { ...context, reason: "approved-revision", workspaceId: "workspace", attemptRevision: 2 },
};

const answered: ReviewRequestView = {
  ...task,
  state: "answered",
  outcome: { kind: "answered", at: "2026-10-10T10:00:00.000Z", by: person, response: { confirmed: true } },
  outcomeText: "Completion confirmed",
};

const cancelled: ReviewRequestView = {
  ...decision,
  state: "cancelled",
  outcome: { kind: "cancelled", at: "2026-10-10T10:00:00.000Z", by: person, reason: "The release scope changed." },
  outcomeText: "Cancelled: The release scope changed.",
};

const row: PlanRow = {
  id: "ticket",
  shorthand: "PS-32",
  title: "Ship the preview",
  status: { id: "in-review", name: "In Review", icon: "eye", color: "orange" },
  state: "await-input",
  done: false,
  trackId: null,
  deadlineId: null,
  step: 1,
  ancestors: [],
  dependsOn: [],
  blocks: [],
  laterDependencies: [],
  flags: ["human-needed"],
  tagIds: [],
  requests: [],
  requestErrors: [],
  instructions: "",
  target: ticketTarget({ id: "ticket", shorthand: "PS-32", title: "Ship the preview" }),
};

const meta: Meta<typeof RequestsPanel> = {
  title: "Extensions/Planner/Timeline requests",
  component: RequestsPanel,
  decorators: [
    (Story) => (
      <Box w="320px" p="md">
        <Story />
      </Box>
    ),
  ],
  args: { row, onAnswer: async () => {}, onOpenChat: async () => {} },
};
export default meta;
type Story = StoryObj<typeof RequestsPanel>;

export const NoRequests: Story = { args: { row: { ...row, state: "not-started", flags: [] } } };
export const Task: Story = { args: { row: { ...row, requests: [task] } } };
export const Decision: Story = { args: { row: { ...row, requests: [decision] } } };
export const AttemptHandoff: Story = { args: { row: { ...row, requests: [handoff] } } };
export const OpenSiblingAfterAnswer: Story = { args: { row: { ...row, requests: [answered, handoff] } } };
export const Cancelled: Story = {
  args: { row: { ...row, state: "not-started", flags: [], requests: [cancelled] } },
};
// Drafts stay in the form when the server refuses the answer.
export const SaveError: Story = {
  args: {
    row: { ...row, requests: [decision] },
    onAnswer: async () => {
      throw new Error("Limits is required.");
    },
  },
};
// A merge can finish the ticket before its approval request is answered.
export const CompleteTicket: Story = {
  args: { row: { ...row, state: "done", done: true, flags: [], requests: [decision] } },
};
export const UnreadableRequest: Story = {
  args: { row: { ...row, requestErrors: ["Request broken: Request title is required."] } },
};
