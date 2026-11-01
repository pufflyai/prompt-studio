/**
 * Run: bun packages/pstdio-api/src/services/personal-history/log-memory.diagnostic.ts
 * Fresh processes compare Cloud-off conversation ownership with the log publisher enabled.
 * This isolates transcript sync overhead; packaged tests cover the full Cloud integration.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync";
import { createProjectRelayConnection, type DocumentRelay } from "pstdio-sync/relay";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { createSessionLogFiles } from "./log-files";
import { createLogPublisher } from "./log-publisher";

if (!process.argv.includes("--worker")) {
  const results = [];
  for (const mode of ["off", "on"]) {
    const child = Bun.spawn([process.execPath, import.meta.path, "--worker", mode], {
      stdout: "pipe",
      stderr: "inherit",
    });
    const output = await new Response(child.stdout).text();
    if (await child.exited) throw new Error("Memory probe failed");
    results.push(JSON.parse(output.trim().split("\n").at(-1)!));
  }
  console.log(
    JSON.stringify({
      results,
      overheadAverageMB: (results[1].averageRss - results[0].averageRss) / 1e6,
      overheadPeakMB: (results[1].peakRss - results[0].peakRss) / 1e6,
    }),
  );
} else {
  const enabled = process.argv.at(-1) === "on";
  const root = await mkdtemp(join(tmpdir(), "session-log-memory-"));
  const app = await createTestApp();
  const project = await app.deps.projectService.create({ name: "Memory probe" });
  const session = await app.deps.sessionService.create({
    project_id: project.id,
    title: "Long session",
    agent: "unavailable",
    status: "in_progress",
  });
  const conversation = await app.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
    .conversationReady;
  const space = await createSyncSpace({
    projectId: project.id,
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const files = createSessionLogFiles(root);
  let sequence = 0;
  let renewals = 0;
  let published = 0;
  const relay: DocumentRelay = {
    async update() {
      published++;
      return { sequence: ++sequence, duplicate: false };
    },
    async read() {
      throw new Error("Publisher must not read transcripts");
    },
    async state() {
      throw new Error("No latest state");
    },
    async replace() {
      throw new Error("No latest state");
    },
  };
  const publisher = createLogPublisher({
    files,
    namespace: "probe",
    deviceId: "device",
    deps: app.deps,
    published() {},
  });
  const controller = new AbortController();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
      },
      message() {},
    },
  });
  const connection = enabled
    ? createProjectRelayConnection({
        origin: server.url.origin,
        projectId: project.id,
        signal: controller.signal,
        access: async () => {
          renewals++;
          return { token: "access", expiresAt: new Date(Date.now() + 500).toISOString() };
        },
      })
    : undefined;
  const owner = connection?.attach({
    signal: controller.signal,
    synchronize: async () => {
      await publisher.publish([session.id], space, () => relay);
    },
  });
  const samples: number[] = [];
  let bytes = 0;
  try {
    for (let index = 0; index < 240; index++) {
      const text = String(index).padStart(5, "0") + "abcdefghijklmnopqrstuvwxyz".repeat(6000);
      bytes += Buffer.byteLength(text);
      conversation.push({
        op: "add",
        path: `/messages/${index}`,
        value: {
          id: `message-${index}`,
          role: "assistant",
          parts: [{ type: "text", text }],
        },
      });
      owner?.wake();
      await Bun.sleep(100);
      samples.push(process.memoryUsage().rss);
    }
    console.log(
      JSON.stringify({
        mode: enabled ? "on" : "off",
        transcriptBytes: bytes,
        renewals,
        published,
        averageRss: samples.reduce((sum, sample) => sum + sample, 0) / samples.length,
        peakRss: Math.max(...samples),
        finalRss: samples.at(-1),
      }),
    );
  } finally {
    controller.abort();
    await connection?.done;
    publisher.close();
    await server.stop(true);
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
}
