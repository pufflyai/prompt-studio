import { afterAll, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { createSessionLogFiles } from "./log-files";
import { sessionLogVersion } from "./log-publication";
import { createLogPublisher } from "./log-publisher";
import { createLogReceiver } from "./log-receiver";
import { logRelayFixture } from "./log-transport.fixture";

const app = await createTestApp();
const project = await app.deps.projectService.create({ name: "Terminal log publication" });
const root = await mkdtemp(join(tmpdir(), "terminal-log-publication-"));
const space = await createSyncSpace({
  projectId: "project",
  spaceOwner: "account",
  keys: [{ generation: 1, secret: "A".repeat(43) }],
});
afterAll(async () => {
  await app.close();
  await rm(root, { recursive: true, force: true });
});

for (const cache of ["memory", "restart", "legacy"] as const) {
  test(`completion within the previous timestamp publishes its last message with a ${cache} cache`, async () => {
    const session = await app.deps.sessionService.create({
      agent: "unavailable",
      project_id: project.id,
      title: "Fast completion",
      status: "in_progress",
    });
    const conversation = await app.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
      .conversationReady;
    const final = { id: "last", role: "assistant" as const, parts: [{ type: "text" as const, text: "complete" }] };
    conversation.push({ op: "add", path: "/messages/0", value: final });
    const files = createSessionLogFiles(join(root, cache));
    const peer = logRelayFixture();
    const proofs: Array<{ head: number; version?: string }> = [];
    const create = () =>
      createLogPublisher({
        files,
        namespace: "source",
        deviceId: "source",
        deps: app.deps,
        published: (_id, head, version) => proofs.push({ head, version }),
      });
    let publisher = create();
    try {
      await publisher.publish([session.id], space, peer.relay);
      expect(peer.updates.size).toBe(0);
      if (cache !== "memory") {
        publisher.close();
        if (cache === "legacy") {
          const saved = await files.readPublished("source", session.id);
          await files.writePublished("source", session.id, {
            updatedAt: saved.updatedAt,
            fingerprints: saved.fingerprints,
            head: saved.head,
          });
        }
        publisher = create();
      }
      // Exercise the real status transition while the clock remains in the same serialized millisecond.
      const now = spyOn(Date, "now").mockReturnValue(Date.parse(session.updated_at!));
      let completed: Awaited<ReturnType<typeof app.deps.sessionService.transitionStatus>>;
      try {
        completed = await app.deps.sessionService.transitionStatus(session.id, "completed");
      } finally {
        now.mockRestore();
      }
      expect(completed?.updated_at).toBe(session.updated_at);
      await publisher.publish([session.id], space, peer.relay, { skipUnchanged: true });
      const received = createSessionLogFiles(join(root, cache, "receiver"));
      await createLogReceiver({ files: received, namespace: "reader", received() {} }).read(
        [session.id],
        space,
        peer.relay,
      );
      expect(await received.read("reader", session.id)).toEqual([final]);
      expect(proofs.at(-1)).toEqual({ head: 1, version: sessionLogVersion(completed!) });
      await publisher.publish([session.id], space, peer.relay, { skipUnchanged: true });
      expect([...peer.updates.values()].flat()).toHaveLength(1);
    } finally {
      publisher.close();
    }
  });
}
