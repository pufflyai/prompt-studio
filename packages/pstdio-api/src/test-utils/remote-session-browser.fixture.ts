import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { HarnessExit, HarnessStartInput, SessionMessage, ToolPart } from "pstdio-api-contracts";
import { jsonSchema } from "pstdio-sync-contracts";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../features/harnesses/test-harness-registry";
import { setupLogger } from "../lib/logger";
import { AccountRequestError, nativeAccountFile } from "../services/account/native-account";
import { createNativeStore } from "../services/account/native-store";
import { capturePersonalHistory } from "../services/personal-history/capture";
import { messageEntries } from "../services/personal-history/log-entries";
import { historyNamespace } from "../services/personal-history/log-files";
import { sessionLogVersion } from "../services/personal-history/log-publication";
import { createHistoryReferences, historyReferenceName } from "../services/personal-history/references";
import { createPersonalHistoryStore } from "../services/personal-history/store";
import { withDeviceCommandAttachments } from "../services/relay/device-command-attachments";
import { createDeviceCommandExecutor } from "../services/relay/device-command-executor";
import { createTestApp } from "./create-test-app";

// This fixture exercises production APIs and browser controls. It simulates manager presence and history
// delivery; encrypted relay transport and hosted identity remain separate backend acceptance checks.
const root = await mkdtemp(join(tmpdir(), "pstdio-remote-session-browser-"));
const earlyExit = () => {
  void rm(root, { recursive: true, force: true }).finally(() => process.exit(0));
};
process.once("SIGTERM", earlyExit);
process.once("SIGINT", earlyExit);
process.env.PSTDIO_HOME = join(root, "home");
process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
const messages = new Map<string, SessionMessage[]>();
const stops: string[] = [];
const answers: unknown[] = [];
const approvals: unknown[] = [];
let online = true;
let queueUnavailable = false;
let failedQueueReads = 0;
let closing = false;
let mirror: (fail?: boolean) => Promise<void> = async () => {};
const record = () =>
  createTestHarnessRecord("browser-remote", {
    provider: {
      start: (_ctx, input) => start(input),
      resume: (_ctx, input) => start(input),
      getMessages: (_ctx, input) => messages.get(input.agentSessionId) ?? [],
    },
  });
const start = (input: HarnessStartInput) => {
  const thread = input.sessionId;
  const history: SessionMessage[] = [
    ...(messages.get(thread) ?? []),
    { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: input.prompt }] },
    { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: "Working on Laptop." }] },
  ];
  messages.set(thread, history);
  input.events.push({ op: "replace", path: "/messages", value: history });
  const done = Promise.withResolvers<HarnessExit>();
  return {
    agentSessionId: thread,
    done: done.promise,
    stop: () => {
      stops.push(thread);
      done.resolve({ status: "cancelled" });
    },
  };
};
const source = await createTestApp({
  storageRoot: join(root, "source"),
  harnessRegistry: createTestHarnessRegistry([record()]),
});
const target = await createTestApp({
  storageRoot: join(root, "target"),
  harnessRegistry: createTestHarnessRegistry([record()]),
});
const sourceId = (await source.deps.environmentService.get()).environmentId;
const targetId = (await target.deps.environmentService.get()).environmentId;
const device = { ownerId: "browser-owner", id: targetId, name: "Laptop" };
const devices = () => [
  { id: sourceId, name: "This device", online: true, current: true, platform: "test", createdAt: "", lastSeenAt: "" },
  { id: targetId, name: "Laptop", online, current: false, platform: "test", createdAt: "", lastSeenAt: "" },
];
const manager = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/v1/devices") return Response.json({ deviceId: sourceId, devices: devices() });
    if (path === "/v1/account") return Response.json({ features: { relay: true } });
    if (path === "/v1/workbenches") return Response.json([]);
    return Response.json({ ok: true });
  },
});
const login = {
  accountId: device.ownerId,
  deviceId: sourceId,
  token: "disposable-browser-fixture",
  managerOrigin: manager.url.origin,
  relayOrigin: manager.url.origin,
};
await createNativeStore(nativeAccountFile(":memory:", join(root, "source"))).save(login);
await source.deps.personalHistoryService.refreshIdentity();
const folder = join(root, "target-only");
await mkdir(folder);
const git = (...args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], { cwd: folder, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode) throw new Error(result.stderr.toString());
};
git("init", "-b", "main");
git("config", "user.name", "Browser fixture");
git("config", "user.email", "fixture@example.invalid");
await Bun.write(join(folder, "target-note.md"), "Original target file.\n");
git("add", ".");
git("commit", "-m", "seed target file");
await Bun.write(join(folder, "target-note.md"), "Target-owned changed content.\n");
const project = await target.deps.projectService.create({
  name: "Remote browser",
});
await source.deps.projectService.create({
  id: project.id,
  name: project.name,
});
await target.deps.projectService.setDefaults(project.id, { default_agent_id: testHarnessId("browser-remote") });
await source.deps.projectService.setDefaults(project.id, { default_agent_id: testHarnessId("browser-remote") });
const workspace = await target.deps.workspaceService.createStandalone({
  project_id: project.id,
  name: "Laptop workspace",
  root_path: folder,
  provider_id: "pstdio.worktree",
  branch: "main",
});
const history = createPersonalHistoryStore({
  ...login,
  projectId: project.id,
  documents: source.deps.extensionStorageService.documents,
  index: source.deps.extensionStorageService.personalHistoryIndex,
  logs: source.deps.extensionStorageService.logs,
  files: source.deps.personalHistoryService.logs,
});
const references = createHistoryReferences(
  source.deps.extensionStorageService.documents.open(historyReferenceName),
  project.id,
);
const namespace = historyNamespace({ ...login, projectId: project.id });
let syncing = Promise.resolve();
mirror = (fail = false) => {
  if (closing) return syncing;
  syncing = syncing
    .catch(() => undefined)
    .then(async () => {
      if (fail) {
        throw new Error("Injected mirror delivery failure");
      }
      await capturePersonalHistory({ projectId: project.id, device, history, references, deps: target.deps });
      const rows = await target.deps.sessionService.list(project.id, { includeArchived: true });
      for (const row of rows) {
        const active = target.deps.sessionService.store.get(row.id)?.conversation?.getMessages();
        if (active) messages.set(row.id, active);
        const content = messages.get(row.id) ?? [];
        await source.deps.personalHistoryService.logs.append(
          namespace,
          row.id,
          content.flatMap((message, index) => messageEntries(index, message)),
        );
        await history.writeHeads(
          new Map([[row.id, 0]]),
          new Map([[row.id, { version: sessionLogVersion(row), head: 0 }]]),
        );
        for (const [index, message] of content.entries())
          source.deps.personalHistoryService.messageReceived(row.id, { index, message, live: false });
      }
      const state = await source.deps.personalHistoryService.fullState(project.id);
      for (const row of state.sessions) source.deps.eventBus.emit("sessions", "set", row);
      for (const row of state.workspaces) source.deps.eventBus.emit("workspaces", "set", row);
      for (const row of state.workspace_sessions) source.deps.eventBus.emit("workspace_sessions", "set", row);
    });
  return syncing;
};
const reportMirrorFailure = (error: unknown) =>
  setupLogger.error({ event: "fixture.remote_session.mirror_failed", err: error }, "Remote fixture mirror failed");
const mirrorInBackground = (fail = false) => {
  void mirror(fail).catch(reportMirrorFailure);
};
const unsubscribe = target.deps.eventBus.subscribe((event) => {
  if (["sessions", "session_queue_entries", "workspace_sessions"].includes(event.table)) mirrorInBackground();
});
const unwatch = target.deps.sessionService.store.watch(() => {
  mirrorInBackground();
});
const execute = createDeviceCommandExecutor(target.deps, project.id);
source.deps.accountService.start(
  async () => {},
  async () => ({ state: "synced", offlineReady: true }),
  async () => {},
  async () => {},
  async (projectId, deviceId, command, signal) => {
    if (projectId !== project.id || deviceId !== targetId || !online)
      throw new AccountRequestError("Laptop is offline");
    if (command.type === "session.queuedMessages" && queueUnavailable) {
      failedQueueReads++;
      throw new AccountRequestError("Queue access is renewing");
    }
    const result = await withDeviceCommandAttachments(source.deps, projectId, command, (value) =>
      execute(jsonSchema.parse(JSON.parse(JSON.stringify(value))), { signal }),
    );
    await mirror();
    return result;
  },
);
const createSession = async (title: string) => {
  const response = await target.app.request("/v1/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: project.id,
      workspace_id: workspace.id,
      agent: testHarnessId("browser-remote"),
      title,
      prompt: title,
    }),
  });
  if (response.status !== 201) throw new Error(await response.text());
  return response.json() as Promise<{ id: string; title: string }>;
};
const session = await createSession("Remote conversation");
const unrelated = await createSession("Other running session");
await mirror();
const workspacesSource = JSON.parse(process.env.E2E_EXTENSION_SOURCES ?? "{}")["pstdio-workspaces"];
// API cleanup tests need only the server fixture; browser callers supply the installed tool source.
if (workspacesSource) {
  const workspacesManifest = await Bun.file(join(workspacesSource, "package.json")).json();
  const installedWorkspaces = await source.app.request(
    `/v1/projects/${project.id}/extensions/installed/pstdio-workspaces/enable`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Workspaces",
        extensionId: "pstdio.pstdio-workspaces",
        manifest: { id: "pstdio.pstdio-workspaces", name: "pstdio-workspaces" },
        name: "pstdio-workspaces",
        sourceHash: crypto.randomUUID(),
        sourceKind: "local_path",
        sourcePath: workspacesSource,
        sourceRef: null,
        version: workspacesManifest.version,
      }),
    },
  );
  if (!installedWorkspaces.ok) throw new Error(await installedWorkspaces.text());
}
const snapshot = async () => ({
  stops,
  answers,
  approvals,
  online,
  failedQueueReads,
  sourceSessions: await source.deps.sessionService.list(project.id),
  targetSessions: await target.deps.sessionService.list(project.id),
  queue: await target.deps.sessionQueueEntriesService.listPendingBySession(session.id),
});
const admin = async (request: Request) => {
  const input = (await request.json()) as { action: string };
  const entry = target.deps.sessionService.store.get(session.id);
  if (input.action === "fail-mirror") {
    await mirror(true);
    return Response.json({ ok: true });
  }
  if (input.action === "fail-background-mirror") {
    mirrorInBackground(true);
    return Response.json({ ok: true });
  }
  if (input.action === "fail-source-close") {
    const originalClose = source.close;
    source.close = async () => {
      await originalClose();
      throw new Error("Injected source close failure");
    };
  }
  if (input.action === "queue-unavailable") queueUnavailable = true;
  if (input.action === "queue-available") queueUnavailable = false;
  if (input.action === "offline") online = false;
  if (input.action === "online") online = true;
  if (input.action === "question") {
    if (!entry?.conversation) throw new Error("Target turn unavailable");
    const tool: ToolPart = {
      type: "tool",
      tool: "question",
      callId: "remote-question",
      status: "pending",
      state: { input: { questions: [{ question: "Which color?", options: [{ label: "Blue" }] }] } },
    };
    const question: SessionMessage = { id: "remote-question-message", role: "assistant", parts: [tool] };
    const index = entry.conversation.messageCount;
    entry.conversation.push({ op: "add", path: `/messages/${index}`, value: question });
    void entry.questionService
      .ask({
        id: "remote-ask",
        toolUseId: "remote-question",
        questions: [{ question: "Which color?", options: [{ label: "Blue" }] }],
      })
      .then(
        (answer) => {
          answers.push(answer);
          entry.conversation?.push({
            op: "replace",
            path: `/messages/${index}`,
            value: { ...question, parts: [{ ...tool, status: "completed", state: { output: "Blue" } }] },
          });
          mirrorInBackground();
        },
        () => {},
      );
  }
  if (input.action === "approval") {
    if (!entry) throw new Error("Target turn unavailable");
    void entry.approvalService
      .requestApproval({
        id: "remote-approval",
        toolName: "shell",
        toolUseId: "remote-shell",
        toolInput: { command: "read target-note.md" },
      })
      .then((answer) => {
        approvals.push(answer);
        mirrorInBackground();
      });
  }
  await mirror();
  return Response.json(await snapshot());
};
const dashboard = resolve(import.meta.dirname, "../../../pstdio-dashboard/dist");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  error: (error) => new Response(error.message, { status: 500 }),
  fetch: async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/fixture/state") return Response.json(await snapshot());
    if (url.pathname === "/fixture/action") return admin(request);
    if (url.pathname.startsWith("/v1/") || url.pathname === "/healthz") return source.app.fetch(request);
    const file = Bun.file(join(dashboard, url.pathname.replace(/^\//, "")));
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(join(dashboard, "index.html")), { headers: { "content-type": "text/html" } });
  },
});
console.log(
  `REMOTE_SESSION_FIXTURE ${JSON.stringify({ origin: server.url.origin, root, projectId: project.id, sessionId: session.id, unrelatedId: unrelated.id, workspaceId: workspace.id, targetId })}`,
);
const close = async () => {
  if (closing) return;
  closing = true;
  control.close();
  unsubscribe();
  unwatch();
  server.stop(true);
  const phase = (name: string) =>
    setupLogger.info({ event: "fixture.remote_session.cleanup", phase: name }, "Remote fixture cleanup");
  phase("delivery-drain");
  await syncing.catch(reportMirrorFailure);
  // Held fake turns own no native process. App close disposes their registry; completing them here
  // would manufacture terminal checkpoint writes during teardown rather than stop an owned resource.
  let failed = false;
  const release = async (resource: string, dispose: () => unknown) => {
    phase(resource);
    try {
      await dispose();
    } catch (error) {
      failed = true;
      setupLogger.error(
        { event: "fixture.remote_session.cleanup_failed", resource, err: error },
        "Remote fixture cleanup failed",
      );
    }
  };
  await release("source-close", () => source.close());
  await release("target-close", () => target.close());
  await release("manager-close", () => manager.stop(true));
  await release("root-remove", () => rm(root, { recursive: true, force: true }));
  phase("complete");
  process.exit(failed ? 1 : 0);
};
process.removeListener("SIGTERM", earlyExit);
process.removeListener("SIGINT", earlyExit);
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
const control = createInterface({ input: process.stdin });
control.on("line", (line) => {
  if (line === "shutdown") void close();
});
