import { expect, test } from "bun:test";
import type { ProjectSyncStatus } from "pstdio-api-contracts";
import { createProjectSyncEvents } from "./project-sync-events";

test("a project's sync event fires only when its derived status changes from the first one read", async () => {
  const states = new Map<string, ProjectSyncStatus>([
    ["cloud", { state: "first-download-incomplete", offlineReady: false }],
    ["local", { state: "local", offlineReady: false }],
  ]);
  const published: [string, ProjectSyncStatus][] = [];
  const events = createProjectSyncEvents({
    status: async (projectId) => states.get(projectId)!,
    publish: (projectId, status) => published.push([projectId, status]),
  });

  // The first read is the starting point that extensions read themselves, so it is not announced.
  await events.changed("cloud");
  await events.changed("local");
  await events.changed("cloud");
  expect(published).toEqual([]);

  states.set("cloud", { state: "synced", offlineReady: true });
  await events.changed("cloud");
  await events.changed("cloud");
  await events.changed("local");
  expect(published).toEqual([["cloud", { state: "synced", offlineReady: true }]]);
});

test("signals that arrive during a status read are coalesced into one more read", async () => {
  let reads = 0;
  const release = Promise.withResolvers<void>();
  const events = createProjectSyncEvents({
    status: async () => {
      reads++;
      await release.promise;
      return { state: "waiting-to-sync", offlineReady: true };
    },
    publish: () => {},
  });

  const first = events.changed("cloud");
  void events.changed("cloud");
  void events.changed("cloud");
  release.resolve();
  await first;
  await events.changed("other");
  expect(reads).toBe(3);
});
