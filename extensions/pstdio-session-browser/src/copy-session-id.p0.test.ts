import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { copySessionId } from "./copy-session-id";

test("copy session ID returns the full reference for both dashboard copying and agent callers", async () => {
  const sessionId = "019a6810-f835-7000-8000-000000000001";
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { resource: { type: "session", id: "different-session" } },
  });
  expect(await copySessionId.run(ctx, { sessionId })).toBe(sessionId);
});
