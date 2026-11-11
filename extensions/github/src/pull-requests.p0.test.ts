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
  expect(parsePullRequest("http://github.com/Acme/Tools/pull/0012")?.id).toBe("https://github.com/acme/tools/pull/12");
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

test("new catalog identities publish one discovery change after persistence", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const changes: { id: string; payload: unknown }[] = [];
  const url = "https://github.com/acme/tools/pull/12";
  const emit = ctx.events.emit;
  ctx.events.emit = async (event, payload) => {
    expect(await storage.collection("pull-requests").get(url)).toBeDefined();
    changes.push({ id: typeof event === "string" ? event : event.id, payload });
    return emit(event, payload);
  };
  await Promise.all([importPullRequest(ctx, url), importPullRequest(ctx, url)]);
  expect(changes).toEqual([{ id: "pull-requests.changed", payload: { id: url } }]);
});

test("concurrent evidence commands share the provider's eight-process limit", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  let active = 0;
  let peak = 0;
  let calls = 0;
  ctx.process.run = async () => {
    calls++;
    active++;
    peak = Math.max(peak, active);
    try {
      await Bun.sleep(2);
      return {
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({ headRefOid: "head", state: "OPEN", baseRefName: "main" }),
      };
    } finally {
      active--;
    }
  };
  await Promise.all(
    ["first", "second"].map((repo) =>
      readPullRequests(
        ctx,
        Array.from({ length: 16 }, (_, index) => `https://github.com/acme/${repo}/pull/${index + 1}`),
      ),
    ),
  );
  expect(calls).toBe(32);
  expect(peak).toBeLessThanOrEqual(8);
});
