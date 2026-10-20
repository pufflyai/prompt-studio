import { expect, test } from "bun:test";
import { projectSyncStatus } from "./project-status";

const ready = { downloaded: true, pending: false, needsAttention: false, connected: true, busy: false };
test("a project cannot be synced or ready offline while any document is missing", () => {
  expect(projectSyncStatus([ready, { ...ready, downloaded: false }])).toEqual({
    state: "first-download-incomplete",
    offlineReady: false,
  });
  expect(projectSyncStatus([{ ...ready, connected: false, downloaded: false }]).state).toBe(
    "first-download-incomplete",
  );
});
test("project sync state comes from the document and transport owners", () => {
  expect(projectSyncStatus([ready])).toEqual({ state: "synced", offlineReady: true });
  expect(projectSyncStatus([{ ...ready, pending: true }]).state).toBe("waiting-to-sync");
  expect(projectSyncStatus([{ ...ready, busy: true }]).state).toBe("waiting-to-sync");
  expect(projectSyncStatus([{ ...ready, connected: false }])).toEqual({ state: "offline", offlineReady: true });
  expect(projectSyncStatus([{ ...ready, needsAttention: true }])).toEqual({
    state: "needs-attention",
    offlineReady: false,
  });
});
