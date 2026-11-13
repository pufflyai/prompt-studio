import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import { createApp } from "pstdio-api/app";
import { createNativeSourceKey } from "pstdio-api-contracts";
import * as Y from "yjs";

type DelayedSubscription = { id: string; release: Promise<void> };

// Delay one logical watch while other editors keep receiving the shared socket.
const delaySubscriptionFrames = (
  body: ReadableStream<Uint8Array>,
  getGate: () => DelayedSubscription | undefined,
  released: (gate: DelayedSubscription) => void,
) => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const delayed = new Map<Promise<void>, string[]>();
  let pending = "";
  let active = true;
  const deliver = (frame: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    const data = frame.split("\n").find((line) => line.startsWith("data: "));
    const subscriptionId = data ? JSON.parse(data.slice(6)).subscription_id : undefined;
    const gate = getGate();
    if (!gate || subscriptionId !== gate.id) {
      controller.enqueue(encoder.encode(frame));
      return;
    }
    let frames = delayed.get(gate.release);
    if (!frames) {
      frames = [];
      delayed.set(gate.release, frames);
      void gate.release.then(() => {
        released(gate);
        if (active) for (const frame of delayed.get(gate.release) ?? []) controller.enqueue(encoder.encode(frame));
        delayed.delete(gate.release);
      });
    }
    frames.push(frame);
  };
  return {
    close: () => {
      active = false;
    },
    body: body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          pending += decoder.decode(chunk, { stream: true });
          let end = pending.indexOf("\n\n");
          while (end !== -1) {
            deliver(pending.slice(0, end + 2), controller);
            pending = pending.slice(end + 2);
            end = pending.indexOf("\n\n");
          }
        },
      }),
    ),
  };
};

export const createNativeDocumentSessionFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "native-editor-session-"));
  const previousHome = process.env.PSTDIO_HOME;
  const previousExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const extensionPath = join(root, "extension");
  const manifest = {
    publisher: "example",
    name: "native-session",
    version: "1.0.0",
    main: "./extension.ts",
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  };
  await Bun.write(join(extensionPath, "package.json"), JSON.stringify(manifest));
  await Bun.write(
    join(extensionPath, "extension.ts"),
    `export default { views: [{
    id: "document", ref: { kind: "view", id: "document" }, title: "Document",
    body: { kind: "file", load: async (ctx) => ({ documentSource: { kind: "workspace", path: "notes.md" }, fileName: "notes.md", content: await ctx.workspaceFiles.readText("notes.md") }),
      save: async (ctx, params) => ctx.workspaceFiles.writeText("notes.md", params.content) },
  }] };`,
  );
  await Bun.write(join(root, "notes.md"), "first\nlast");
  const handle = await createApp({
    config: {
      database: { path: ":memory:" },
      storage: { root: join(root, "storage") },
      sync: { eventBufferSize: 1000 },
      automation: { runsPerMinute: 60 },
      extensions: { buildWebviews: false, release: null },
      transport: { terminalOrigins: [] },
    },
    host: { kind: "standalone" },
  });
  const project = await handle.deps.projectService.create({ name: "Native session" });
  await handle.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder", root_path: root });
  const installed = await handle.deps.extensionService.syncInstalledSourceForProject({
    projectId: project.id,
    extensionId: "example.native-session",
    installName: "native-session",
    name: "native-session",
    sourceKind: "local_path",
    sourcePath: extensionPath,
    displayName: "Native session",
    manifest,
  });
  await handle.deps.extensionService.setProjectExtensionEnabled(installed!.instance.id, true);
  let offline = false;
  const disconnects = new Set<() => void>();
  let pause:
    | {
        operation: "open" | "updates" | "stream";
        entered: ReturnType<typeof Promise.withResolvers<void>>;
        release: ReturnType<typeof Promise.withResolvers<void>>;
      }
    | undefined;
  let delayedSubscription: DelayedSubscription | undefined;
  const fetcher = (async (url, init) => {
    if (offline) throw new Error("Test network is offline");
    const path = new URL(String(url)).pathname;
    const admission = path.endsWith("/subscriptions") && init?.method === "POST";
    const streamGate = admission && pause?.operation === "stream" ? pause : undefined;
    if (streamGate) {
      const input = JSON.parse(String(init?.body)) as { subscription_id: string };
      delayedSubscription = { id: input.subscription_id, release: streamGate.release.promise };
    }
    const response = await handle.app.fetch(new Request(String(url), init));
    let operation: "updates" | "open" | "stream" | undefined;
    if (admission) operation = "stream";
    else if (path.endsWith("/updates")) operation = "updates";
    else if (path.endsWith("/native-documents")) operation = "open";
    if (pause && init?.method === "POST" && pause.operation === operation) {
      const gate = pause;
      pause = undefined;
      gate.entered.resolve();
      await gate.release.promise;
    }
    if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
      const frames = delaySubscriptionFrames(
        response.body,
        () => delayedSubscription,
        (gate) => {
          if (delayedSubscription === gate) delayedSubscription = undefined;
        },
      );
      const reader = frames.body.getReader();
      let disconnect = () => {};
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          disconnect = () => {
            frames.close();
            controller.error(new Error("Test network disconnected"));
            void reader.cancel().catch(() => {});
          };
          disconnects.add(disconnect);
        },
        async pull(controller) {
          try {
            const next = await reader.read();
            if (next.done) {
              frames.close();
              disconnects.delete(disconnect);
              controller.close();
            } else controller.enqueue(next.value);
          } catch (error) {
            frames.close();
            disconnects.delete(disconnect);
            controller.error(error);
          }
        },
        async cancel() {
          frames.close();
          disconnects.delete(disconnect);
          await reader.cancel().catch(() => {});
        },
      });
      return new Response(body, { status: response.status, headers: response.headers });
    }
    return response;
  }) as typeof fetch;
  return {
    projectId: project.id,
    target: { fileRendererId: "example.native-session.view.document", resource: undefined },
    client: createClient({ baseUrl: "http://localhost", fetch: fetcher }).nativeDocuments,
    setOffline(value: boolean) {
      offline = value;
      if (value) {
        for (const disconnect of disconnects) disconnect();
        disconnects.clear();
      }
    },
    pauseNextAcknowledgement() {
      const gate = {
        operation: "updates" as const,
        entered: Promise.withResolvers<void>(),
        release: Promise.withResolvers<void>(),
      };
      pause = gate;
      return gate;
    },
    pauseNextStream() {
      const gate = {
        operation: "stream" as const,
        entered: Promise.withResolvers<void>(),
        release: Promise.withResolvers<void>(),
      };
      pause = gate;
      return gate;
    },
    pauseNextHandshake() {
      const gate = {
        operation: "open" as const,
        entered: Promise.withResolvers<void>(),
        release: Promise.withResolvers<void>(),
      };
      pause = gate;
      return gate;
    },
    async adopt(state: Uint8Array) {
      const owner = { workbenchId: project.id, extensionId: "example.native-session" };
      const fileId = createNativeSourceKey(["workspace", "notes.md"]);
      const text = handle.deps.extensionStorageService.openNativeTextDocument({ owner, fileId });
      const remote = new Y.Doc();
      Y.applyUpdate(remote, state);
      const candidate = await text.store.initialHistory.prepare(owner, remote);
      try {
        const merged = await text.store.initialHistory.merge(owner, candidate ?? remote);
        merged?.destroy();
      } finally {
        candidate?.destroy();
        remote.destroy();
      }
    },
    close: async () => {
      await handle.close();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
      if (previousExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
      else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousExtensions;
      await rm(root, { recursive: true, force: true });
    },
  };
};
