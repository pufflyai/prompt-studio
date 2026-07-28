import { afterEach, describe, expect, mock, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import {
  applyDashboardSessionMessagePatch,
  fetchDashboardSessionConversationMessages,
  resolveDashboardStreamEndMessages,
} from "@/modules/sessions/data/session-messages";

const originalFetch = globalThis.fetch;

const message = (id: string): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text: id }],
});

describe("dashboard workbench session messages", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("hydrates messages from the session conversation endpoint", async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ messages: [message("hydrated-message")] }), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const messages = await fetchDashboardSessionConversationMessages("session-1");

    expect(messages).toEqual([message("hydrated-message")]);
  });

  test("applies stream message patches", () => {
    const messages = applyDashboardSessionMessagePatch([message("old")], {
      op: "replace",
      path: "/messages",
      value: [message("new")],
    });

    expect(messages).toEqual([message("new")]);
  });

  test("keeps hydrated messages when a stream ends without patches", () => {
    expect(resolveDashboardStreamEndMessages([], [message("hydrated")])).toEqual([message("hydrated")]);
  });

  test("keeps the fuller hydrated conversation when stream replay is partial", () => {
    const hydratedMessages = [message("user"), message("pending-question")];

    expect(resolveDashboardStreamEndMessages([message("user")], hydratedMessages)).toEqual(hydratedMessages);
  });
});
