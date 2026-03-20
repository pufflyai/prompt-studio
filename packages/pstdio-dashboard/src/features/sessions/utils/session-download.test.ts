import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { Session } from "../types";
import { buildSessionDownload } from "./session-download";

const session: Session = {
  id: "session-123",
  projectId: "project-1",
  agentSessionId: null,
  title: "Fix flaky tests",
  status: "completed",
  archived: false,
  agent: "claude-code",
  createdAt: "2026-02-20T10:00:00.000Z",
  updatedAt: "2026-02-21T12:00:00.000Z",
};

const conversation: SessionMessage[] = [
  {
    id: "message-1",
    role: "user",
    parts: [{ type: "text", text: "How do I fix this?" }],
  },
  {
    id: "message-2",
    role: "assistant",
    parts: [{ type: "text", text: "Try updating the failing test first." }],
  },
];

describe("buildSessionDownload", () => {
  it("returns a readable file name that includes title and id", () => {
    const download = buildSessionDownload(session, conversation);

    expect(download.fileName).toBe("fix-flaky-tests-session-123.json");
  });

  it("returns formatted JSON with the full session and conversation payload", () => {
    const download = buildSessionDownload(session, conversation);

    expect(download.content).toBe(
      JSON.stringify(
        {
          session,
          messages: conversation,
        },
        null,
        2,
      ),
    );
  });
});
