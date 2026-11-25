import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectSyncStatus } from "pstdio-api-contracts";
import { createDocumentRelayConnection } from "pstdio-sync/relay";
import { liveClientMessageSchema, liveProtocolVersion } from "pstdio-sync-contracts";
import { projectOwnerProgress } from "../relay/project-owner-progress";
import { createProjectSyncRetry } from "../relay/project-sync-retry";
import { createAccountHostFixture } from "./native-host.fixture";
import { createNativeStore } from "./native-store";
import { createProjectCopyStore } from "./project-copy-store";

const until = async (ready: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!ready() && Date.now() < deadline) await Bun.sleep(5);
  return ready();
};

for (const [stored, failedState] of [
  [true, "first-download-incomplete"],
  [false, "first-download-incomplete"],
  [true, "offline"],
  [false, "offline"],
] as const)
  test(`Download retries a failed source without restarting healthy work (stored: ${stored}, state: ${failedState})`, async () => {
    const root = await mkdtemp(join(tmpdir(), "native-download-retry-"));
    const host = await createAccountHostFixture(root, ":memory:");
    const id = crypto.randomUUID();
    const controller = new AbortController();
    const firstResponse = Promise.withResolvers<Response>();
    const finishRetry = Promise.withResolvers<void>();
    const sourceFailed = Promise.withResolvers<void>();
    const sockets = new Set<Bun.ServerWebSocket<undefined>>();
    let phase: "initial" | "failed" | "retry" = "initial";
    let allowLive = true;
    let sourceRequests = 0;
    let manualRetries = 0;
    let firstDownloaded = false;
    let downloaded = false;
    let source: ReturnType<typeof createDocumentRelayConnection> | undefined;
    const readSource = async () => {
      sourceRequests++;
      if (phase === "initial") return firstResponse.promise;
      if (phase === "failed") return Response.json({ error: "Source unavailable" }, { status: 503 });
      await finishRetry.promise;
      return Response.json({ ok: true });
    };
    const manager = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request, server) {
        if (request.headers.get("upgrade") === "websocket") {
          if (!allowLive) return new Response(null, { status: 503 });
          if (server.upgrade(request)) return;
        }
        const path = new URL(request.url).pathname;
        if (path === "/v1/account") return Response.json({ features: { relay: true } });
        if (path === "/v1/workbenches") return Response.json([{ workbenchId: id }]);
        if (path === "/v1/project-deletions") return Response.json([]);
        if (path === "/source") return readSource();
        return Response.json({ ok: true });
      },
      websocket: {
        open(socket) {
          sockets.add(socket);
          socket.send(JSON.stringify({ type: "ready", protocolVersion: liveProtocolVersion }));
        },
        message(socket, value) {
          const frame = liveClientMessageSchema.parse(JSON.parse(String(value)));
          if ("requestId" in frame && frame.requestId)
            socket.send(JSON.stringify({ type: "control-result", requestId: frame.requestId, retryAfterMs: 0 }));
        },
        close(socket) {
          sockets.delete(socket);
        },
      },
    });
    const api = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => host.app.fetch(request) });
    const readSync = async () => {
      const response = await fetch(`${api.url.origin}/v1/account/projects/${id}/sync`);
      expect(response.status).toBe(200);
      return (await response.json()) as ProjectSyncStatus;
    };
    try {
      await host.projects.create({ id, name: "Interrupted Cloud copy" });
      const { environmentId } = await host.deps.environmentService.get();
      const account = { managerOrigin: manager.url.origin, accountId: "account", deviceId: environmentId };
      await createNativeStore(host.file).save({ ...account, relayOrigin: manager.url.origin, token: "fixture-device" });
      if (stored)
        await createProjectCopyStore(host.file).write({
          ...account,
          projectId: id,
          name: "Interrupted Cloud copy",
          phase: "downloading",
          automatic: true,
        });
      source = createDocumentRelayConnection({
        origin: manager.url.origin,
        projectId: id,
        signal: controller.signal,
        access: async () => ({ token: "fixture-relay", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        async synchronize(signal) {
          const response = await fetch(`${manager.url.origin}/source`, { signal });
          if (!response.ok) throw new Error("Source unavailable");
          await response.json();
          firstDownloaded = true;
          downloaded = true;
        },
        onStatusChange() {
          if (source?.status().error) sourceFailed.resolve();
        },
      });
      const retry = createProjectSyncRetry({
        refresh: async () => {},
        owners: {
          core: {
            get: () => ({
              status: source!.status,
              prepareRetry() {
                const retry = source!.prepareRetry();
                return () => {
                  manualRetries++;
                  allowLive = true;
                  return retry();
                };
              },
              restart: source!.restart,
              retry() {
                manualRetries++;
                allowLive = true;
                return source!.retry();
              },
            }),
          },
        },
        folders: { get: () => undefined },
        extensions: new Map(),
      });
      host.account.start(
        async () => {},
        async () =>
          projectOwnerProgress(
            id,
            [
              {
                ...source!.status(),
                firstDownloaded,
                downloaded,
                pending: false,
                needsAttention: false,
                canRetry: true,
              },
            ],
            [],
            [],
          ),
        async () => {},
        retry,
      );
      await host.account.refresh();
      expect(await until(() => sourceRequests === 1)).toBe(true);
      const expected = new URLSearchParams({ accountId: account.accountId, managerOrigin: account.managerOrigin });
      const download = () =>
        fetch(`${api.url.origin}/v1/account/projects/${id}/download?${expected}`, { method: "POST" });
      expect((await readSync()).state).toBe("first-download-incomplete");
      expect((await download()).status).toBe(202);
      await host.account.refresh();
      expect({ manualRetries, sourceRequests }).toEqual({ manualRetries: 0, sourceRequests: 1 });
      if (failedState === "offline") {
        firstResponse.resolve(Response.json({ ok: true }));
        expect(await until(() => downloaded)).toBe(true);
        downloaded = false;
        phase = "failed";
        source.wake();
      } else {
        firstResponse.resolve(Response.json({ error: "Source unavailable" }, { status: 503 }));
      }
      await sourceFailed.promise;
      if (failedState === "offline") {
        allowLive = false;
        for (const socket of sockets) socket.close();
        expect(await until(() => !source!.status().connected)).toBe(true);
      }
      const failed = await readSync();
      expect(failed).toMatchObject({ state: failedState, offlineReady: false });
      expect(failed.sources?.[0]).toMatchObject({ error: "Cloud source failed; retry scheduled", canRetry: true });
      const failedRequests = sourceRequests;
      phase = "retry";
      expect((await download()).status).toBe(202);
      await until(() => manualRetries === 1);
      expect(manualRetries).toBe(1);
      expect(await until(() => sourceRequests === failedRequests + 1)).toBe(true);
      expect((await download()).status).toBe(202);
      expect(manualRetries).toBe(1);
      expect(sourceRequests).toBe(failedRequests + 1);
      finishRetry.resolve();
      expect(await until(() => downloaded)).toBe(true);
    } finally {
      firstResponse.resolve(Response.json({ ok: true }));
      finishRetry.resolve();
      controller.abort();
      await source?.done;
      await api.stop(true);
      await host.close();
      await manager.stop(true);
      await rm(root, { recursive: true, force: true });
    }
  });
