import { expect, test } from "bun:test";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayPersonalHistory } from "./personal";

test("late private-history admissions catch up and drain inside the initial sync window", async () => {
  const app = await createTestApp();
  const admissions: { topic: string; release: () => void }[] = [];
  const reads = new Map<string, number>();
  const peer = documentPeer([], {
    beforeSubscribe: async (_deviceId, topic) => {
      const gate = Promise.withResolvers<void>();
      admissions.push({ topic, release: () => gate.resolve() });
      await gate.promise;
    },
    onRead: (id) => reads.set(id, (reads.get(id) ?? 0) + 1),
  });
  const controller = new AbortController();
  let sync: ReturnType<typeof startRelayPersonalHistory> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Late private admissions" });
    app.deps.accountService.devices = async () => [];
    sync = startRelayPersonalHistory({
      deps: app.deps,
      config: {
        accountId: "alice",
        workbenchId: project.id,
        environmentId: (await app.deps.environmentService.get()).environmentId,
        managerOrigin: peer.origin,
        relayOrigin: peer.origin,
        renewalGrant: "grant",
      },
      signal: controller.signal,
      access: async () => ({ token: "reader", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
    // Keep the packaged acceptance's existing five-second initial sync window. Two admissions
    // near its end reproduce the late follow-up round without shortening a publishing interval.
    const started = Date.now();
    const deadline = started + 5000;
    const until = async (condition: () => Promise<boolean> | boolean) => {
      while (!(await condition()) && Date.now() < deadline) await Bun.sleep(5);
      expect(await condition()).toBe(true);
    };
    const clean = async () => {
      const status = await sync!.status();
      return status.downloaded && !status.pending && !status.busy;
    };
    await until(async () => admissions.length === 1 && (await clean()));
    const first = admissions[0]!;
    const firstReads = reads.get(first.topic) ?? 0;
    await Bun.sleep(Math.max(0, started + 4200 - Date.now()));
    first.release();
    await until(async () => admissions.length === 2 && (reads.get(first.topic) ?? 0) > firstReads && (await clean()));
    const second = admissions[1]!;
    const secondReads = reads.get(second.topic) ?? 0;
    await Bun.sleep(Math.max(0, started + 4500 - Date.now()));
    second.release();
    await until(async () => (reads.get(second.topic) ?? 0) > secondReads && (await clean()));
    expect(peer.subscriptions().map((entry) => entry.topics.length)).toEqual([2]);
    expect((await app.deps.sessionService.query(project.id)).rows).toEqual([]);
  } finally {
    for (const admission of admissions) admission.release();
    sync?.close();
    controller.abort();
    await sync?.done;
    await peer.close();
    await app.close();
  }
});
