import { expect, test } from "bun:test";
import { activeRun, claimEnvironment, releaseEnvironment } from "./environments";
import { createRunStorage as createMemoryStorage } from "./run-storage-fixture";

test("only one concurrent run can claim the same environment", async () => {
  const store = createMemoryStorage();
  const claims = await Promise.all([
    claimEnvironment(store, "environment", "first"),
    claimEnvironment(store, "environment", "second"),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
});

test("a late release cannot remove a replacement claim", async () => {
  const store = createMemoryStorage();
  expect(await claimEnvironment(store, "environment", "old")).toBe(true);
  await releaseEnvironment(store, "environment", "old");
  expect(await claimEnvironment(store, "environment", "new")).toBe(true);
  await releaseEnvironment(store, "environment", "old");
  expect(await claimEnvironment(store, "environment", "other")).toBe(false);
});

test("lists owned branch environments across controller pages", async () => {
  const environment = (id: string, template: string, projectId = "owned") => ({
    id,
    external_id: id,
    state: "ready",
    reason_code: null,
    change_cursor: 0,
    created_at: "2026-01-01T00:00:00Z",
    deadline_at: null,
    template: { name: template, version: "1.0.0" },
    metadata: { purpose: "remote-testing", pstdio_project_id: projectId },
    failure: null,
  });
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const query = new URL(request.url).searchParams;
      if (query.get("template")) return Response.json({ items: [], next_cursor: null });
      if (query.get("cursor"))
        return Response.json({ items: [environment("base", "remote-tests")], next_cursor: null });
      return Response.json({
        items: [environment("branch", "remote-tests-branch"), environment("foreign", "remote-tests", "other")],
        next_cursor: "next",
      });
    },
  });
  try {
    const api: import("./connection").Api = async (input) => {
      const response = await fetch(new URL(input.path, server.url));
      return response.json() as never;
    };
    const { listEnvironments } = await import("./environments");
    expect((await listEnvironments(api, "owned")).map((item) => item.id)).toEqual(["branch", "base"]);
  } finally {
    server.stop(true);
  }
});

test("an elapsed setup lease never makes an unfinished run available for reuse", async () => {
  const store = createMemoryStorage();
  await store.collection("environment-claims").put("environment", { runId: "old", until: Date.now() - 1 });
  expect(await claimEnvironment(store, "environment", "new")).toBe(false);
  expect(await activeRun(store, "environment")).toBe("old");
});

test("durable claims remain fenced for readers of the legacy until field", async () => {
  const store = createMemoryStorage();
  await claimEnvironment(store, "new", "owner");
  const claim = await store.collection<{ runId: string; until: number }>("environment-claims").get("new");
  expect(claim?.until).toBe(Number.MAX_SAFE_INTEGER);
  expect(claim!.until > Date.now()).toBe(true);
});
