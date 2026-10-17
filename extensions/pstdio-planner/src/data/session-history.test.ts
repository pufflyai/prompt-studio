import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { readSessionHistory } from "./session-history";

test("reads every query page in chronological order and keeps the workspace filter", async () => {
  const calls: unknown[] = [];
  const { sessions } = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  sessions.query = async (input) => {
    calls.push(input);
    return {
      items: [{ id: input?.cursor ? "older" : "newer" }],
      nextCursor: input?.cursor ? null : "page-2",
    } as Awaited<ReturnType<typeof sessions.query>>;
  };
  expect((await readSessionHistory(sessions, { workspaceId: "workspace" })).map(({ id }) => id)).toEqual([
    "older",
    "newer",
  ]);
  expect(calls).toEqual([
    { includeArchived: true, workspaceId: "workspace", limit: 200 },
    { includeArchived: true, workspaceId: "workspace", limit: 200, cursor: "page-2" },
  ]);
});
