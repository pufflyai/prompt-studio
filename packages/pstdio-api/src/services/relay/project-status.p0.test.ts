import { expect, test } from "bun:test";
import { projectSyncStatus } from "./project-status";

const ready = {
  firstDownloaded: true,
  downloaded: true,
  pending: false,
  needsAttention: false,
  connected: true,
  busy: false,
};
test("a project cannot be synced or ready offline while any document is missing", () => {
  expect(projectSyncStatus([ready, { ...ready, firstDownloaded: false, downloaded: false }])).toMatchObject({
    state: "first-download-incomplete",
    offlineReady: false,
  });
  expect(projectSyncStatus([{ ...ready, connected: false, firstDownloaded: false, downloaded: false }]).state).toBe(
    "first-download-incomplete",
  );
});
test("project sync state comes from the document and transport owners", () => {
  expect(projectSyncStatus([ready])).toMatchObject({ state: "synced", offlineReady: true });
  expect(projectSyncStatus([{ ...ready, pending: true }]).state).toBe("waiting-to-sync");
  expect(projectSyncStatus([{ ...ready, busy: true }]).state).toBe("waiting-to-sync");
  expect(projectSyncStatus([{ ...ready, connected: false }])).toMatchObject({ state: "offline", offlineReady: true });
  expect(projectSyncStatus([{ ...ready, needsAttention: true }])).toMatchObject({
    state: "needs-attention",
    offlineReady: false,
  });
});
test("catching up after the first download waits to sync instead of restarting the first download", () => {
  const catchingUp = { ...ready, downloaded: false };
  expect(projectSyncStatus([catchingUp])).toMatchObject({ state: "waiting-to-sync", offlineReady: false });
  expect(projectSyncStatus([{ ...catchingUp, connected: false }])).toMatchObject({
    state: "offline",
    offlineReady: false,
  });
});
