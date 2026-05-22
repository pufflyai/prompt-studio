import type { SessionMessage } from "@pstdio/ui/chat-ui";

// One mock thread per session id so switching sessions in the bubble shows a
// distinct conversation. Sessions without a thread fall back to an empty state.
const shellReviewConversation: SessionMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "Walk me through the failures in the e2e suite." }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "Inspecting the latest run logs and grouping failures by signature." },
      {
        type: "tool",
        tool: "workbench",
        callId: "tool-1",
        actionType: "execute",
        status: "completed",
        state: {
          input: { command: "bun run test:e2e --reporter=list" },
          output:
            "Running 23 tests...\n  PASS workspaces > sidebar navigation (1.2s)\n  FAIL workspaces > diff regenerates (8.4s)\n  FAIL sessions > follow-up ordering (4.1s)\n  FAIL checks > status refresh (2.0s)\n3 failed\n",
        },
      },
      {
        type: "text",
        text: "Two of the failures share a teardown ordering bug; the third is a flaky filter. I have a patch ready. Want me to apply it?",
      },
    ],
  },
  {
    id: "u2",
    role: "user",
    parts: [{ type: "text", text: "Yes, ship the patch and re-run on CI." }],
  },
  {
    id: "a2",
    role: "assistant",
    parts: [
      {
        type: "tool",
        tool: "edit",
        callId: "tool-2",
        actionType: "write",
        status: "completed",
        state: {
          input: { path: "packages/e2e/src/setup/teardown.ts" },
          output: "Updated teardown order to await pending fetches before clearing mocks.",
        },
      },
      { type: "text", text: "Patch applied. CI is running, ETA ~6 minutes." },
    ],
  },
  {
    id: "u3",
    role: "user",
    parts: [{ type: "text", text: "While that runs, check whether this affects the workspace changes view." }],
  },
  {
    id: "a3",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "Opening the workbench view and tracing the changed-file renderer path." },
      {
        type: "tool",
        tool: "workbench",
        callId: "tool-3",
        actionType: "execute",
        status: "completed",
        state: {
          input: {
            command: "bun test packages/pstdio-dashboard-wb/src/workbench/dashboard-workbench-navigation.test.ts",
          },
          output:
            "PASS opens workspace sidebar session entries in the floating session panel\nPASS opens session resources from the sessions sidebar mode\nPASS preserves project navigation while the session bubble is available\n",
        },
      },
      {
        type: "text",
        text: "The workspace changes view still resolves the selected resource correctly. The session bubble remains available while workspace and settings resources move through the main area.",
      },
    ],
  },
  {
    id: "u4",
    role: "user",
    parts: [{ type: "text", text: "Good. Leave me a short summary of what changed before the next CI result lands." }],
  },
  {
    id: "a4",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Summary: the teardown now waits for pending fetches before clearing mocks, the sessions ordering assertion uses the real sidebar selection path, and the checks refresh test no longer races the status update event.",
      },
    ],
  },
  {
    id: "u5",
    role: "user",
    parts: [{ type: "text", text: "CI finished. Pull the result and tell me if anything is still blocking." }],
  },
  {
    id: "a5",
    role: "assistant",
    parts: [
      {
        type: "tool",
        tool: "github",
        callId: "tool-4",
        actionType: "read",
        status: "completed",
        state: {
          input: { check: "e2e / dashboard-workspaces" },
          output:
            "dashboard-workspaces: passed\nsessions-follow-up-ordering: passed\nchecks-status-refresh: passed\nlint: passed\n",
        },
      },
      {
        type: "text",
        text: "Nothing is blocking now. The relevant CI checks are green and the earlier failure signatures did not recur.",
      },
    ],
  },
  {
    id: "u6",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Queue the follow-up that adds an e2e assertion for the floating chat panel staying inside the bubble when the session is long.",
      },
    ],
  },
  {
    id: "a6",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "Capturing the regression as a UI flow because the issue depends on panel sizing." },
      {
        type: "tool",
        tool: "ticket",
        callId: "tool-5",
        actionType: "write",
        status: "completed",
        state: {
          input: { id: "PS-184", title: "Assert long floating chat layout" },
          output: "Saved follow-up with acceptance coverage for long sessions, sticky composer, and bubble bounds.",
        },
      },
      {
        type: "text",
        text: "Follow-up queued. I included the long-session case, the composer position, and the bubble bounds in the acceptance notes.",
      },
    ],
  },
];

const sidebarParityConversation: SessionMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [
      { type: "text", text: "Make the workspace sidebar collapse and resize exactly like the sessions sidebar." },
    ],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "Comparing both sidebar widgets and their area size constraints." },
      {
        type: "tool",
        tool: "edit",
        callId: "tool-1",
        actionType: "write",
        status: "completed",
        state: {
          input: { path: "packages/pstdio-dashboard-wb/src/workbench/modules/workspaces/workspace-sidebar-tree.ts" },
          output: "Aligned the workspace sidebar area size and collapse affordance with the sessions sidebar.",
        },
      },
      {
        type: "text",
        text: "Done — both sidebars now share the same collapse affordance and resize bounds.",
      },
    ],
  },
];

const listModeConversation: SessionMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "Extract the sessions surface into its own workbench mode." }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "Splitting the sessions overview, sidebar, and chat view out of the workspace mode." },
      {
        type: "text",
        text: "I moved the sessions overview, sidebar, and chat view into a dedicated `sessions` mode. Should the floating session bubble stay available while that mode is active, or close with it?",
      },
    ],
  },
];

const widgetTabsConversation: SessionMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "Turn the changes and checks panels into widget tabs in the main area." }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Queued. I'll register a widget per panel and open them as tabs when a workspace is selected.",
      },
    ],
  },
];

export const dashboardSessionConversations: Record<string, SessionMessage[]> = {
  "session-shell-review": shellReviewConversation,
  "session-sidebar-parity": sidebarParityConversation,
  "session-list-mode": listModeConversation,
  "session-widget-tabs": widgetTabsConversation,
};
