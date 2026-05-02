import type { SessionMessage } from "../chat-ui/components/message-types";

export const mockChatMessages: SessionMessage[] = [
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
        tool: "shell",
        callId: "tool-1",
        actionType: "execute",
        status: "completed",
        state: {
          input: { command: "bun run test:e2e --reporter=list" },
          output:
            "Running 23 tests…\n  ✓ tickets > drag and drop (1.2s)\n  ✘ workspaces > diff regenerates (8.4s)\n  ✘ sessions > follow-up ordering (4.1s)\n  ✘ tickets > flaky filter (2.0s)\n2 failed, 1 flaky\n",
        },
      },
      {
        type: "text",
        text: "Two of the failures share a teardown ordering bug; the third is a flaky filter. I have a patch ready — want me to apply it?",
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
      { type: "text", text: "Patch applied — CI is running, ETA ~6 minutes." },
    ],
  },
];
