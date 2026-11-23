import { expect, test } from "bun:test";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createExtensionConnectionService } from "./extension-connection-service";
import { connection, contribution } from "./extension-connection-service.test-fixture";

const input = {
  projectId: "project-1",
  extensionId: "pstdio.remote",
  connectionId: "control-plane",
  input: { method: "POST" as const, path: "/v1/workspaces" },
};

function fixture(scope: "project" | "global", mode: "catalog" | "bookkeeping" | "network") {
  let retired = false;
  let lookups = 0;
  let requests = 0;
  const failure = new Error("Upstream unavailable");
  const checks: unknown[] = [];
  const service = createExtensionConnectionService({
    connectionsDBService: {
      get: async () => ({ ...connection, project_id: scope === "global" ? null : input.projectId }),
      recordCheck: async (key: unknown) => {
        checks.push(key);
        if (mode === "bookkeeping") throw new Error("Metadata unavailable");
      },
    } as never,
    secretStore: {
      get: async () => "credential-canary",
      set: async () => "secret-1",
      delete: async () => {},
      listRefs: async () => [],
    },
    getContribution: async () => {
      lookups++;
      if (retired && mode !== "bookkeeping") throw new Error("Catalog unavailable");
      return { ...contribution, scope, supportsStreaming: true };
    },
    fetch: (async () => {
      requests++;
      retired = true;
      if (mode === "network") throw failure;
      return Response.json({ created: true });
    }) as unknown as typeof fetch,
    onRequestComplete: () => {
      if (mode === "bookkeeping") throw new Error("Audit unavailable");
    },
  });
  return { service, checks, failure, lookups: () => lookups, requests: () => requests };
}

for (const scope of ["project", "global"] as const) {
  test.each([
    "catalog",
    "bookkeeping",
    "network",
  ] as const)(`${scope} request bookkeeping preserves the upstream outcome (%s)`, async (mode) => {
    const f = fixture(scope, mode);
    if (mode === "network") await expectRejection(f.service.request(input)).toBe(f.failure);
    else expect(await f.service.request(input)).toMatchObject({ status: 200, body: { created: true } });
    expect(f.requests()).toBe(1);
    expect(f.lookups()).toBe(1);
    expect(f.checks).toEqual([
      {
        projectId: scope === "global" ? null : input.projectId,
        extensionId: input.extensionId,
        contributionId: input.connectionId,
      },
    ]);
  });
}

test("a completed connection stream does not reload a retired catalog for bookkeeping", async () => {
  const f = fixture("global", "catalog");
  const events = [];
  for await (const event of f.service.stream(input)) events.push(event);
  expect(events.at(-1)).toEqual({ type: "end" });
  expect(f.requests()).toBe(1);
  expect(f.lookups()).toBe(1);
  expect(f.checks).toMatchObject([{ projectId: null }]);
});
