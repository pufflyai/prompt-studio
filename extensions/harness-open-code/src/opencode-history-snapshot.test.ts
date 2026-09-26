import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { appendFailureMessage, readSessionSnapshot } from "./opencode-session-poller";
import { recordingSink, userMessage } from "./opencode-session-poller.test-helpers";

const failure: SessionMessage = {
  id: "opencode-error-s-1",
  role: "system",
  parts: [{ type: "error", errorType: "other", message: "local failure" }],
};
const user: SessionMessage = { id: "old-user", role: "user", parts: [{ type: "text", text: "again" }] };

test("a poll reads the current owner after its native read finishes", async () => {
  const { sink } = recordingSink();
  sink.push({ op: "replace", path: "/messages", value: [user] });
  const native = Promise.withResolvers<ReturnType<typeof userMessage>[]>();
  const polling = readSessionSnapshot({
    events: sink,
    sessionId: "s",
    cwd: undefined,
    loadMessages: () => native.promise,
    lastObserved: [],
    lastSnapshot: "",
    latestMessages: [],
  });
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  native.resolve([userMessage("again")]);
  await polling;
  expect(sink.getMessages()).toHaveLength(2);
  expect(sink.getMessages().at(-1)).toEqual(failure);
});

test("ambiguous poll metadata reports a history issue without publishing a replacement", async () => {
  const { sink, patches } = recordingSink();
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  await expect(
    readSessionSnapshot({
      events: sink,
      sessionId: "s",
      cwd: undefined,
      loadMessages: async () => [userMessage("again"), userMessage("again")],
      lastObserved: [],
      lastSnapshot: "",
      latestMessages: [],
    }),
  ).rejects.toThrow();
  expect(sink.getMessages()).toEqual([user, failure]);
  expect(patches.at(-1)).toMatchObject({ path: "/history_issue", value: { code: "reconciliation_conflict" } });
});

test("a generated failure appends to the current conversation", () => {
  const { sink } = recordingSink();
  sink.push({ op: "replace", path: "/messages", value: [user, failure] });
  appendFailureMessage({ events: sink, sessionId: "s", failureMessage: "new failure" });
  expect(sink.getMessages().slice(0, 2)).toEqual([user, failure]);
});
