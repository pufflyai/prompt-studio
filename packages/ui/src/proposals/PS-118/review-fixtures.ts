import type { ActivityActor } from "@/components/activity";

export interface AgentTarget {
  harnessId: string;
  model: string;
  handle: string;
  available: boolean;
}

export interface SessionSnapshot {
  id: string;
  resourceId: string;
  label: string;
  body: string;
  thread: string;
}

export interface ReviewEntry {
  id: string;
  text: string;
  target?: AgentTarget;
  handoff?: "starting" | "failed" | "linked";
  session?: SessionSnapshot;
}

export interface ReviewThread {
  kind: "comment";
  id: string;
  quote?: string;
  resolved: boolean;
  timestamp?: string;
  entries: ReviewEntry[];
}

export interface ActivityChange {
  before: string;
  after: string;
}

export interface ResourceEvent {
  kind: "event";
  id: string;
  actor: ActivityActor;
  message: string;
  timestamp: string;
  change?: ActivityChange;
}

export interface ReviewDraft {
  quote?: string;
  text: string;
  target?: AgentTarget;
  threadId?: string;
}

// A local study of a resource opting in. This is not a new public API contract.
export interface PrototypeResource {
  id: string;
  label: string;
  markdown: string;
  status?: string;
  activity?: {
    comments: boolean;
    trackChanges: boolean;
    items: (ResourceEvent | ReviewThread)[];
    draft: ReviewDraft;
    pendingBody?: string;
  };
}

export const author: ActivityActor = { name: "You" };
export const agents: AgentTarget[] = [
  { harnessId: "pstdio.harness-codex.harness.codex", model: "gpt-6.1", handle: "codex:gpt-6.1", available: true },
  {
    harnessId: "pstdio.harness-claude-code.harness.claude-code",
    model: "sonnet",
    handle: "claude-code:sonnet",
    available: true,
  },
  {
    harnessId: "pstdio.harness-open-code.harness.open-code",
    model: "default",
    handle: "open-code:default",
    available: false,
  },
];

const ticketBody = `# Resource activity

Resources can opt into activity. Comments and changes appear together below the resource content.

## Review a passage

Select text to comment on a specific passage. The quote stays with the discussion in Activity.

Mention an agent to hand over the resource and complete thread after confirmation.
`;

export const initialResources: PrototypeResource[] = [
  {
    id: "PS-118",
    label: "PS-118 · Resource activity",
    markdown: ticketBody,
    status: "Backlog",
    activity: {
      comments: true,
      trackChanges: true,
      draft: { text: "" },
      items: [
        { kind: "event", id: "created", actor: author, message: "created the ticket", timestamp: "1h ago" },
        { kind: "event", id: "status", actor: author, message: "moved from Todo to Backlog", timestamp: "45m ago" },
        {
          kind: "comment",
          timestamp: "30m ago",
          id: "selection",
          quote: "Select text to comment on a specific passage.",
          resolved: false,
          entries: [
            {
              id: "selection-1",
              text: "Use the shared Activity component so this works for every resource that supports it.",
            },
          ],
        },
        {
          kind: "event",
          id: "description",
          actor: author,
          message: "updated the description",
          timestamp: "20m ago",
          change: { before: "# Ticket comments\n\nAdd a separate panel for ticket comments.", after: ticketBody },
        },
        {
          kind: "comment",
          timestamp: "10m ago",
          id: "removed",
          quote: "Comments live in a separate ticket panel.",
          resolved: false,
          entries: [
            { id: "removed-1", text: "This passage has been removed. Keep the discussion in the resource's Activity." },
          ],
        },
      ],
    },
  },
  {
    id: "note",
    label: "Note · Review checklist",
    markdown:
      "# Review checklist\n\nCheck the scope, review the prototype, and leave feedback here.\n\nThis note supports comments without tracking content edits.",
    activity: {
      comments: true,
      trackChanges: false,
      draft: { text: "" },
      items: [
        {
          kind: "comment",
          id: "note-comment",
          resolved: false,
          entries: [{ id: "note-entry", text: "Keep review feedback alongside this note." }],
        },
      ],
    },
  },
  {
    id: "readme",
    label: "Document · Getting started",
    markdown:
      "# Getting started\n\nOpen a resource to work with its content.\n\nThis document does not provide an activity state.",
  },
];

export const threadMarkdown = (resource: PrototypeResource, thread: ReviewThread) =>
  [
    `# Discussion · ${resource.label}`,
    thread.quote ? `> ${thread.quote}` : "",
    ...thread.entries.map((entry) => `### You\n\n${entry.text}${entry.target ? `\n\n@${entry.target.handle}` : ""}`),
  ]
    .filter(Boolean)
    .join("\n\n");
