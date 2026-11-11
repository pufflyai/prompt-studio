import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { importPullRequest, parsePullRequest, readPullRequests } from "./pull-requests";

test("PR identity includes host and repository and ignores URL decorations", () => {
  expect(parsePullRequest("https://github.com/Acme/Tools/pull/12/files?x=1#review")).toEqual({
    id: "https://github.com/acme/tools/pull/12",
    host: "github.com",
    repository: "acme/tools",
    number: 12,
  });
  expect(parsePullRequest("https://github.com/acme/other/pull/12")?.id).not.toBe(
    parsePullRequest("https://github.com/acme/tools/pull/12")?.id,
  );
  expect(parsePullRequest("https://github.com/acme/tools/issues/12")).toBeNull();
});

test("imports reuse a project resource and unavailable reads never return cached merge evidence", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const first = await importPullRequest(ctx, "https://github.com/Acme/Tools/pull/12");
  expect(await importPullRequest(ctx, `${first.id}/files`)).toEqual(first);
  expect(await ctx.storage.collection("pull-requests").list()).toHaveLength(1);
  let calls = 0;
  ctx.process.run = async () => {
    calls++;
    return {
      exitCode: 0,
      stdout: JSON.stringify({
        state: "MERGED",
        headRefOid: "head",
        baseRefName: "main",
        mergeCommit: { oid: "merge" },
      }),
      stderr: "",
    };
  };
  expect(await readPullRequests(ctx, [first.id, first.id])).toHaveLength(1);
  expect(calls).toBe(1);
  ctx.process.run = async () => {
    throw new Error("offline");
  };
  expect(await readPullRequests(ctx, [first.id])).toEqual([{ id: first.id, error: expect.any(String) }]);
  expect(await ctx.storage.collection("pull-requests").list()).toHaveLength(1);
});
