import { expect, test } from "bun:test";
import { projectSyncStatus } from "./project-status";

const ready = {
  firstDownloaded: true,
  downloaded: true,
  pending: false,
  pendingItems: 0,
  needsAttention: false,
  connected: true,
  busy: false,
  download: { completed: 2, total: 2 },
};

test("project progress adds actual pending documents and verified downloads from its owners", () => {
  const pending = { ...ready, downloaded: false, pending: true, pendingItems: 3, download: { completed: 1, total: 4 } };
  expect(projectSyncStatus([ready, pending])).toMatchObject({
    state: "waiting-to-sync",
    pendingItems: 3,
    download: { completed: 3, total: 6 },
  });
  expect(projectSyncStatus([ready, ready])).toMatchObject({ pendingItems: 0, download: { completed: 4, total: 4 } });
});

test("an undiscovered owner keeps the project download total unknown", () => {
  expect(
    projectSyncStatus([
      ready,
      { ...ready, firstDownloaded: false, downloaded: false, download: { completed: 0, total: null } },
    ]),
  ).toMatchObject({
    state: "first-download-incomplete",
    download: { completed: 2, total: null },
  });
});
