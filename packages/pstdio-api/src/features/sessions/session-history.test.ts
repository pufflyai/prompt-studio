import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { getSessionHistory, loadSessionHistory } from "./session-history";
import { createSessionStore } from "./session-store";

test("a reader waiting on an obsolete initializer follows the new conversation owner", async () => {
  const store = createSessionStore();
  const first = Promise.withResolvers<SessionMessage[]>();
  store.create(
    "s",
    () => {},
    () => first.promise,
  );
  const deps = { sessionService: { store } } as Parameters<typeof getSessionHistory>[1];
  const reading = getSessionHistory("s", deps);
  const next = store.create("s", () => {});
  const messages: SessionMessage[] = [{ id: "new", role: "user", parts: [{ type: "text", text: "next" }] }];
  (await next.conversationReady).push({ op: "replace", path: "/messages", value: messages });
  first.resolve([]);
  expect((await reading).messages).toEqual(messages);
});

test("an unavailable native transcript and no saved checkpoint cannot become a successful empty history", async () => {
  const deps = {
    sessionService: { get: async () => ({ id: "s", agent: "agent", agent_session_id: "thread" }) },
    harnessRegistry: {
      get: async () => ({
        supportsHistory: true,
        getMessages: async () => {
          throw new Error("unavailable");
        },
      }),
    },
  } as never;
  await expect(loadSessionHistory("s", deps)).rejects.toThrow("history");
  expect((await loadSessionHistory("s", deps, [])).messages).toEqual([]);
});
