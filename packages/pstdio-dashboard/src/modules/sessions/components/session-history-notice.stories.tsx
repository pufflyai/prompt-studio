import { createRendererReadRegistry } from "@pstdio/workbench";
import type { Meta, StoryObj } from "@storybook/react";
import { SessionHistoryNotice } from "./session-history-notice";

const meta = {
  title: "Sessions/History review",
  component: SessionHistoryNotice,
  args: {
    sessionId: "example",
    ownerKey: "history-review-story",
    reads: createRendererReadRegistry(),
    retry: () => {},
    issue: { code: "reconciliation_conflict", category: "ambiguous_turns" },
    loadSources: async () => ({
      checkpoint: [{ id: "saved", role: "user", parts: [{ type: "text", text: "Review the tickets" }] }],
      native: [{ id: "native", role: "user", parts: [{ type: "text", text: "Review the tickets" }] }],
      checkpointError: null,
      nativeError: null,
    }),
  },
} satisfies Meta<typeof SessionHistoryNotice>;
export default meta;
type Story = StoryObj<typeof SessionHistoryNotice>;
export const ConflictingHistory: Story = {};
export const AgentHistoryUnavailable: Story = {
  args: { issue: { code: "native_unavailable", category: "native_unavailable" } },
};
export const UnreadableSavedHistory: Story = {
  args: {
    issue: { code: "checkpoint_unreadable", category: "checkpoint_unreadable" },
    loadSources: async () => ({
      checkpoint: null,
      native: [],
      checkpointError: "checkpoint_unreadable",
      nativeError: null,
    }),
  },
};
