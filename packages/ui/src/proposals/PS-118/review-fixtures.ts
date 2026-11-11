export interface AgentTarget {
  harnessId: string;
  model: string;
  handle: string;
  available: boolean;
}

export interface ReviewEntry {
  id: string;
  text: string;
  target?: AgentTarget;
  handoff?: "starting" | "failed" | "linked";
  session?: { id: string; ticket: string; thread: string };
}

export interface ReviewThread {
  id: string;
  quote: string;
  resolved: boolean;
  entries: ReviewEntry[];
}

export interface ReviewDraft {
  quote: string;
  text: string;
  target?: AgentTarget;
  threadId?: string;
}

export const agents: AgentTarget[] = [
  { harnessId: "pstdio.harness-codex", model: "gpt-6.1", handle: "codex:gpt-6.1", available: true },
  { harnessId: "pstdio.harness-claude-code", model: "sonnet", handle: "claude-code:sonnet", available: true },
  { harnessId: "pstdio.harness-open-code", model: "default", handle: "open-code:default", available: false },
];

export const ticketMarkdown = `# Review ticket changes with an agent

Let people discuss a passage in a ticket without rewriting its description.

## Comment on the ticket

Select text to start a review thread. Replies stay with the selected passage, even when the document changes.

Resolve a thread when the feedback is addressed. Resolved comments remain available for later review.

## Ask an agent

Mention one installed agent and model in a comment. Confirm before starting a session with the current ticket and the complete thread attached.

If the session cannot start, keep the comment and offer a retry.

## Acceptance

- Keep comments separate from the ticket Markdown.
- Keep discussions when their selected text is removed.
- Show open comments on ticket cards and lists.
`;

export const initialThreads: ReviewThread[] = [
  {
    id: "selection",
    quote: "Select text to start a review thread.",
    resolved: false,
    entries: [{ id: "selection-1", text: "Can we make this available from the keyboard too?" }],
  },
  {
    id: "removed",
    quote: "Comments are stored inside the ticket description.",
    resolved: false,
    entries: [{ id: "removed-1", text: "Keep the discussion separate so editing the ticket never removes feedback." }],
  },
  {
    id: "resolved",
    quote: "If the session cannot start, keep the comment and offer a retry.",
    resolved: true,
    entries: [{ id: "resolved-1", text: "Agreed. Retrying should keep this comment and start only one session." }],
  },
];

export const threadMarkdown = (thread: ReviewThread) =>
  [
    `# Review thread · PS-118`,
    `> ${thread.quote}`,
    ...thread.entries.map((entry) => `### You\n\n${entry.text}${entry.target ? `\n\n@${entry.target.handle}` : ""}`),
  ].join("\n\n");
