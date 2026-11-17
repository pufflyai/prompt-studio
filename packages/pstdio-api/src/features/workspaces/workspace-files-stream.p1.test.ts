import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createClient } from "@pstdio/sdk/client";
import type { AppBindings } from "../../types";
import {
  openSessionStreamHandler,
  subscribeSessionStreamHandler,
  subscribeSessionStreamRoute,
  unsubscribeSessionStreamHandler,
  unsubscribeSessionStreamRoute,
} from "../sessions/endpoints/session-stream";
import { createSessionStreamConnections } from "../sessions/session-stream-connections";
import { EventBus } from "../sync/event-bus";
import { listWorkspaceFilesHandler, listWorkspaceFilesRoute } from "./endpoints/workspace-files";

test("file explorer observations share one stream and see external entries without navigation", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-files-stream-"));
  const row = {
    id: "workspace",
    project_id: "project",
    root_path: root,
    execution_kind: "local",
    provider_id: "pstdio.worktree",
    provider_state: "ready",
    initializing: false,
    provider_capabilities_json: { files: "write", diff: false },
    deleted_at: null,
    setup_error: null,
  };
  const eventBus = new EventBus();
  const deps = { workspaceService: { get: async () => row }, eventBus } as never;
  const app = new OpenAPIHono<AppBindings>();
  const routes = new OpenAPIHono<AppBindings>();
  const connections = createSessionStreamConnections();
  routes.get("/session-stream", openSessionStreamHandler(connections));
  routes.openapi(subscribeSessionStreamRoute, subscribeSessionStreamHandler(deps, connections));
  routes.openapi(unsubscribeSessionStreamRoute, unsubscribeSessionStreamHandler(connections));
  routes.openapi(listWorkspaceFilesRoute, listWorkspaceFilesHandler(deps));
  app.route("/v1", routes);
  let streams = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/v1/session-stream") streams++;
      return app.fetch(request);
    },
  });
  const client = createClient({ baseUrl: server.url.origin });
  const firstReady = Promise.withResolvers<void>();
  const secondReady = Promise.withResolvers<void>();
  const changed = Promise.withResolvers<void>();
  const firstAbort = new AbortController();
  const secondAbort = new AbortController();
  const first = client.workspaces.watchFiles("workspace", {
    projectId: "project",
    signal: firstAbort.signal,
    onReady: firstReady.resolve,
    onChange: () => {},
  });
  const second = client.workspaces.watchFiles("workspace", {
    projectId: "project",
    signal: secondAbort.signal,
    onReady: secondReady.resolve,
    onChange: changed.resolve,
  });
  try {
    await Promise.all([firstReady.promise, secondReady.promise]);
    expect(streams).toBe(1);
    expect((await client.workspaces.listFiles("workspace")).entries).toEqual([]);
    firstAbort.abort();
    await first;
    await writeFile(join(root, "external.txt"), "A new line\n");
    await changed.promise;
    expect((await client.workspaces.listFiles("workspace")).entries.map((entry) => entry.path)).toEqual([
      "external.txt",
    ]);
    await expect(
      client.workspaces.watchFiles("workspace", {
        projectId: "wrong",
        signal: secondAbort.signal,
        onReady() {},
        onChange() {},
      }),
    ).rejects.toThrow("not available");
    eventBus.emit("workspaces", "delete", { id: "workspace" });
    await second;
  } finally {
    firstAbort.abort();
    secondAbort.abort();
    await Promise.allSettled([first, second]);
    await server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
