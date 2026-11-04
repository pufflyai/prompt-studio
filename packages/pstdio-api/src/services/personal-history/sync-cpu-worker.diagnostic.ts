import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionSource } from "../../features/extensions/extension-runtime";
import { createTestExtensionSource } from "../../features/extensions/test-utils/create-test-extension-source";
import { initializeProjectWorkspace } from "../../features/projects/project-folder";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayRuntime } from "../relay/runtime";

const [role, managerOrigin, relayOrigin, projectId] = process.argv.slice(2) as [string, string, string, string];
process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
const root = await mkdtemp(join(tmpdir(), "sync-cpu-device-"));
process.env.PSTDIO_HOME = join(root, "home");
const app = await createTestApp({ storageRoot: join(root, "storage") });
const project = await app.deps.projectService.create({ id: projectId, name: "Sync CPU" });
await mkdir(join(root, "checkout"));
await initializeProjectWorkspace(
  app.deps,
  project.id,
  { provider_id: "pstdio.root", params: { path: join(root, "checkout") } },
  async () => [],
);
for (let index = 0; index < 25; index++) {
  const name = `quiet-${index}`;
  const path = createTestExtensionSource({ root, name, installName: name, displayName: name });
  const source = await loadExtensionSource(path);
  await app.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    sourcePath: path,
    extensionId: source.metadata.id,
    installName: name,
    name,
    displayName: name,
    manifest: source.manifest,
    version: "0.0.0",
  });
}
const deviceId = (await app.deps.environmentService.get()).environmentId;
const prior = await app.deps.accountService.status();
app.deps.accountService.status = async () => ({
  ...prior,
  login: { accountId: "owner", deviceId, managerOrigin, relayOrigin },
  cloudProjects: [projectId],
  cloudProjectsLoaded: true,
});
app.deps.accountService.devices = async () => [];
const runtime = await startRelayRuntime({ deps: app.deps });
const running: {
  id: string;
  streamId: string;
  conversation: Awaited<ReturnType<typeof app.deps.sessionService.store.create>["conversationReady"]>;
}[] = [];
if (role === "source") {
  for (let index = 0; index < 2000; index++)
    await app.deps.sessionService.create({
      project_id: projectId,
      title: `Saved ${index}`,
      agent: "unavailable",
      status: "completed",
    });
  for (let index = 0; index < 3; index++) {
    const session = await app.deps.sessionService.create({
      project_id: projectId,
      title: `Streaming ${index}`,
      agent: "unavailable",
      status: "in_progress",
    });
    const conversation = await app.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
      .conversationReady;
    if (index === 0)
      for (let message = 0; message < 120; message++)
        conversation.push({
          op: "add",
          path: `/messages/${message}`,
          value: {
            id: String(message),
            role: "assistant",
            parts: [{ type: "text", text: "saved history ".repeat(15_000) }],
          },
        });
    conversation.push({
      op: "add",
      path: `/messages/${conversation.messageCount}`,
      value: { id: "stream", role: "assistant", parts: [{ type: "text", text: "start" }] },
    });
    running.push({ id: session.id, streamId: "stream", conversation });
  }
}
let streaming = true;
let tick = 0;
const interval = setInterval(() => {
  if (!streaming) return;
  tick++;
  for (const entry of running) {
    const { conversation, id } = entry;
    if (tick % 200 === 0) {
      entry.streamId = `stream-${tick}`;
      conversation.push({
        op: "add",
        path: `/messages/${conversation.messageCount}`,
        value: { id: entry.streamId, role: "assistant", parts: [{ type: "text", text: "Next completed message" }] },
      });
      void app.deps.sessionService.update(id, {});
    }
    conversation.push({
      op: "replace",
      path: `/messages/${conversation.messageCount - 1}`,
      value: {
        id: entry.streamId,
        role: "assistant",
        parts: [
          { type: "text", text: `tick ${tick} at ${Date.now()}\n${"streaming output ".repeat((tick % 100) + 1)}` },
        ],
      },
    });
  }
}, 100);
const requests: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = ((request, init) => {
  const url = request instanceof Request ? request.url : String(request);
  if (url.startsWith(relayOrigin)) requests.push(new URL(url).pathname);
  return originalFetch(request, init);
}) as typeof fetch;
let cpu = process.cpuUsage();
let started = performance.now();
let reading: (() => void) | undefined;
let previews = 0;
let maxLagMs = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const { action, id } = (await request.json()) as { action: string; id?: string };
    if (action === "on")
      await runtime.update([
        {
          accountId: "owner",
          environmentId: deviceId,
          workbenchId: projectId,
          managerOrigin,
          relayOrigin,
          renewalGrant: deviceId,
        },
      ]);
    if (action === "off") await runtime.update([]);
    if (action === "idle") {
      streaming = false;
      clearInterval(interval);
      for (const { id } of running)
        await app.deps.sessionService.transitionStatus(id, "completed", { drainCapacity: false });
    }
    if (action === "watch")
      reading = app.deps.personalHistoryService.watchMessages(
        id!,
        (update) => {
          if (!update.live) return;
          previews++;
          const part = update.message.parts.find((part) => part.type === "text");
          const match = part?.type === "text" && /at (\d+)/.exec(part.text);
          if (match) maxLagMs = Math.max(maxLagMs, Date.now() - Number(match[1]));
        },
        projectId,
      );
    if (action === "unwatch") {
      reading?.();
      reading = undefined;
    }
    if (action === "start") {
      requests.length = 0;
      previews = 0;
      maxLagMs = 0;
      started = performance.now();
      cpu = process.cpuUsage();
    }
    if (action === "sample") {
      const elapsedMs = performance.now() - started;
      const usage = process.cpuUsage(cpu);
      return Response.json({
        elapsedMs,
        cpuMs: (usage.user + usage.system) / 1000,
        cpuPercent: (usage.user + usage.system) / (elapsedMs * 10),
        requests: requests.length,
        paths: [...new Set(requests)],
        previews,
        maxLagMs,
      });
    }
    if (action === "status") return Response.json(await runtime.status(projectId));
    return Response.json({ ok: true });
  },
});
console.log(JSON.stringify({ ready: server.url.origin, deviceId, sessions: running.map(({ id }) => id) }));
const close = async () => {
  clearInterval(interval);
  reading?.();
  await server.stop(true);
  await runtime.close();
  await app.close();
  await rm(root, { recursive: true, force: true });
  process.exit(0);
};
process.once("SIGTERM", () => void close());
process.once("SIGINT", () => void close());
