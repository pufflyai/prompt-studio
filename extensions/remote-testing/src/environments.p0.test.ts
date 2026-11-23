import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { claimEnvironment, releaseEnvironment } from "./environments";

test("only one concurrent run can claim the same environment", async () => {
  const store = createMemoryStorage();
  const claims = await Promise.all([
    claimEnvironment(store, "environment", "first", 60),
    claimEnvironment(store, "environment", "second", 60),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
});

test("a late release cannot remove a replacement claim", async () => {
  const store = createMemoryStorage();
  expect(await claimEnvironment(store, "environment", "old", -1)).toBe(true);
  expect(await claimEnvironment(store, "environment", "new", 60)).toBe(true);
  await releaseEnvironment(store, "environment", "old");
  expect(await claimEnvironment(store, "environment", "other", 60)).toBe(false);
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
