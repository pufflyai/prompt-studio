import { expect, test } from "bun:test";
import { ciBase, readQueueChanges, selectQueuePulls } from "./ci-event";

const queuePage = (second: boolean) => ({
  data: {
    repository: {
      mergeQueue: {
        entries: {
          nodes: [
            {
              headCommit: { oid: second ? "last" : "first" },
              pullRequest: {
                number: second ? 2 : 1,
                changedFiles: second ? 1 : 100,
                labels: { nodes: second ? [{ name: "ci:full" }] : [], pageInfo: { hasNextPage: false } },
              },
            },
          ],
          pageInfo: { hasNextPage: !second, endCursor: second ? null : "next" },
        },
      },
    },
  },
});

test("a merge group compares all entries with its payload base", () => {
  expect(ciBase("merge_group", { merge_group: { base_sha: "a".repeat(40) } })).toBe("a".repeat(40));
  expect(ciBase("pull_request", {})).toBe("HEAD~1");
});

test("a missing or invalid group base cannot silently narrow the diff", () => {
  expect(() => ciBase("merge_group", {})).toThrow();
  expect(() => ciBase("merge_group", { merge_group: { base_sha: "HEAD~1" } })).toThrow();
});

test("every entry in a group contributes its PR labels and files", () => {
  const entries = [
    { headCommit: { oid: "previous" }, pullRequest: { number: 1 } },
    { headCommit: { oid: "first" }, pullRequest: { number: 2 } },
    { headCommit: { oid: "last" }, pullRequest: { number: 3 } },
    { headCommit: { oid: "later" }, pullRequest: { number: 4 } },
  ];
  expect(selectQueuePulls(entries, new Set(["first", "last"]), "last")).toEqual([{ number: 2 }, { number: 3 }]);
});

test("an unavailable merge group cannot be mistaken for a documentation-only PR", () => {
  expect(() => selectQueuePulls([], new Set(["last"]), "last")).toThrow();
});

test("queue API pagination preserves a companion PR's ci:full and renamed inputs", async () => {
  const requests: string[] = [];
  let unavailable = true;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      requests.push(url.pathname);
      if (unavailable) {
        unavailable = false;
        return new Response(null, { status: 503 });
      }
      if (url.pathname === "/graphql") {
        const { variables } = (await request.json()) as { variables: { after: string | null } };
        return Response.json(queuePage(variables.after === "next"));
      }
      if (url.pathname.includes("/pulls/1/")) {
        const length = url.searchParams.get("page") === "1" ? 100 : 0;
        return Response.json(Array.from({ length }, (_, i) => ({ filename: `packages/sdk/file-${i}.ts` })));
      }
      return Response.json([
        { filename: "packages/pstdio-api/new.ts", previous_filename: "packages/pstdio-db/old.ts" },
      ]);
    },
  });
  process.env.GITHUB_API_URL = server.url.origin;
  process.env.GITHUB_REPOSITORY = "fixture/repo";
  process.env.GH_TOKEN = "fixture-token";
  try {
    const result = await readQueueChanges(
      { merge_group: { base_sha: "a".repeat(40), head_sha: "last", base_ref: "refs/heads/main" } },
      new Set(["first", "last"]),
    );
    expect(result.labels).toContain("ci:full");
    expect(result.changedFiles).toContain("packages/pstdio-db/old.ts");
    expect(result.changedFiles).toContain("packages/pstdio-api/new.ts");
    expect(result.changedFiles).toContain("packages/sdk/file-99.ts");
    expect(requests.filter((path) => path === "/graphql")).toHaveLength(3);
    expect(requests.filter((path) => path === "/repos/fixture/repo/pulls/1/files")).toHaveLength(2);
  } finally {
    await server.stop(true);
  }
});
