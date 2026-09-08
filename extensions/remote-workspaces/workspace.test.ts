import { afterEach, describe, expect, test } from "bun:test";
import extension from "./extension";
import { remoteWorkspace, startPocketCoderTestServer, workspaceId, workspaceResource } from "./pocketcoder-test-server";

const provider = extension.workspaceTypes![0]!;
const servers: ReturnType<typeof startPocketCoderTestServer>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop();
});
const serve = (handle: Parameters<typeof startPocketCoderTestServer>[0]) => {
  const server = startPocketCoderTestServer(handle);
  servers.push(server);
  return server;
};
const input = {
  projectId: "project-1",
  workspaceId: "host-workspace",
  operationId: "create-1",
  providerRef: remoteWorkspace.executionTarget.providerRef,
};

describe("PocketCoder workspaces", () => {
  test("creates from a template with a stable idempotency key and maps the provider reference", async () => {
    const server = serve(() => Response.json(workspaceResource("queued"), { status: 201 }));
    const result = await provider.create(server.ctx as never, {
      ...input,
      params: { template: "pi-harness", repository: "app", revision: "main" },
    });
    expect(server.requests).toEqual([
      {
        method: "POST",
        path: "/v1/workspaces",
        idempotencyKey: "create-1",
        body: {
          external_id: "host-workspace",
          template: { name: "pi-harness" },
          source: { kind: "git", repository: "app", revision: "main" },
        },
      },
    ]);
    expect(result).toMatchObject({ state: "provisioning", executionKind: "remote", providerRef: input.providerRef });
    expect(result.executionTarget).toEqual(remoteWorkspace.executionTarget);
  });

  test("allows a template without a repository override", async () => {
    const server = serve(() => Response.json(workspaceResource()));
    await provider.create(server.ctx as never, { ...input, params: { template: "pi-harness" } });
    expect(server.requests[0]?.body).toEqual({ external_id: "host-workspace", template: { name: "pi-harness" } });
  });

  test.each([
    ["queued", "provisioning"],
    ["provisioning", "provisioning"],
    ["connected", "provisioning"],
    ["ready", "ready"],
    ["terminating", "deleting"],
    ["canceled", "cancelled"],
    ["failed", "failed"],
    ["expired", "failed"],
    ["succeeded", "archived"],
    ["preserving", "archiving"],
    ["preserved", "archived"],
  ] as const)("maps %s to %s", async (state, expected) => {
    const server = serve(() => Response.json(workspaceResource(state)));
    const result = await provider.resolve(server.ctx as never, input);
    expect(result.state).toBe(expected);
    expect(result.capabilities).toEqual({
      files: "none",
      diff: false,
      merge: false,
      rebase: false,
      archive: false,
      delete: true,
    });
  });

  test("waits for remote cancellation before deleting the host workspace", async () => {
    const server = serve((request) => {
      if (new URL(request.url).pathname.endsWith("/cancel")) return Response.json(workspaceResource("terminating"));
      return Response.json({ cursor: 2, changed: true, workspace: workspaceResource("canceled") });
    });
    await provider.delete!(server.ctx as never, input);
    expect(server.requests.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: "POST", path: `/v1/workspaces/${workspaceId}/cancel` },
      { method: "GET", path: `/v1/workspaces/${workspaceId}/changes` },
    ]);
  });

  test("reports PocketCoder errors instead of projecting an HTTP failure as a workspace", async () => {
    const server = serve(() =>
      Response.json({ error: { code: "template.not_found", message: "Template missing" } }, { status: 404 }),
    );
    await expect(provider.create(server.ctx as never, { ...input, params: { template: "missing" } })).rejects.toThrow(
      "Template missing",
    );
  });
});
