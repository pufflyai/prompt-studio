import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { combineSessionMessageSources } from "./session-messages";

const message = (id: string) => ({ id, role: "user", parts: [{ type: "text", text: id }] }) satisfies SessionMessage;

test("keeps the durable queue alongside live transcript updates", () => {
  const queued = message("queued-prompt-session-1-7");
  expect(combineSessionMessageSources([message("live")], [message("old"), queued], "session-1")).toEqual([
    message("live"),
    queued,
  ]);
});

test("removes a dispatched queue item when the conversation refreshes", () => {
  expect(combineSessionMessageSources([message("live")], [message("live")], "session-1")).toEqual([message("live")]);
});
