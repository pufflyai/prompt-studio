import { describe, expect, mock, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { submitSessionMessage } from "./session-chat-view-actions";

const noopMessageList: SessionMessage[] = [];

describe("submitSessionMessage attachment lifecycle", () => {
  test("keeps draft attachments after create session request succeeds", () => {
    const clearDraftAttachments = mock(() => {});

    submitSessionMessage({
      sessionId: null,
      projectId: "project-1",
      agent: "fake",
      model: undefined,
      text: "hello",
      attachments: [{ id: "a-1", file_name: "shot.png", mime_type: "image/png", size_bytes: 10 }],
      messages: noopMessageList,
      pendingIdRef: { current: 0 },
      clearSessionDraft: () => {},
      setChatDraft: () => {},
      setPendingFollowUp: () => {},
      createSession: {
        mutate: (_input, options) => {
          options.onSuccess({ sessionId: "s-1" });
        },
      },
      followUp: {
        mutate: () => {},
      },
      reconnect: () => {},
    });

    expect(clearDraftAttachments).not.toHaveBeenCalled();
  });

  test("keeps draft attachments after follow-up request succeeds", () => {
    const clearDraftAttachments = mock(() => {});

    submitSessionMessage({
      sessionId: "session-1",
      projectId: "project-1",
      agent: "fake",
      model: undefined,
      text: "follow-up",
      attachments: [{ id: "a-1", file_name: "shot.png", mime_type: "image/png", size_bytes: 10 }],
      messages: noopMessageList,
      pendingIdRef: { current: 0 },
      clearSessionDraft: () => {},
      setChatDraft: () => {},
      setPendingFollowUp: () => {},
      createSession: {
        mutate: () => {},
      },
      followUp: {
        mutate: (_input, options) => {
          options.onSuccess();
        },
      },
      reconnect: () => {},
    });

    expect(clearDraftAttachments).not.toHaveBeenCalled();
  });
});
