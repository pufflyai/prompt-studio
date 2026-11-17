import { describe, expect, test } from "bun:test";
import type { AccountStatus, ProjectSyncStatus } from "@pstdio/sdk/extensions";
import { cloudStatus } from "./status";

const account: AccountStatus = {
  login: { managerOrigin: "https://account.test", relayOrigin: "https://relay.test", accountId: "a", deviceId: "d" },
  features: { relay: true },
  cloudProjects: ["project"],
  cloudProjectsLoaded: true,
};
const synced: ProjectSyncStatus = { state: "synced", offlineReady: true };

describe("Cloud status", () => {
  test("shows connection loss before sign-in and account loading", () => {
    const offline: ProjectSyncStatus = { state: "offline", offlineReady: true };
    expect(cloudStatus({ ...account, login: null }, offline).key).toBe("offline");
    expect(cloudStatus({ ...account, signInRequired: true }, offline).key).toBe("offline");
    expect(cloudStatus(undefined, undefined, undefined, false).key).toBe("offline");
    expect(cloudStatus({ ...account, login: null }, synced, undefined, false).key).toBe("offline");
    expect(cloudStatus({ ...account, login: null }, synced).key).toBe("signIn");
  });
  test("keeps folder preparation and setup failure visible after the download finishes", () => {
    expect(cloudStatus(account, synced, { state: "preparing" }).key).toBe("preparing");
    expect(cloudStatus(account, synced, { state: "failed", error: "Cannot prepare folder" }).key).toBe("attention");
    expect(cloudStatus(account, synced, { state: "ready" }).key).toBe("synced");
  });
  test("keeps a disconnected account visible before its feature flags can be refreshed", () => {
    expect(cloudStatus({ ...account, features: null }, { state: "offline", offlineReady: true }).key).toBe("offline");
  });
  test("distinguishes a local project from a disconnected cloud project", () => {
    expect(cloudStatus(account, { state: "local", offlineReady: true }).key).toBe("local");
    expect(cloudStatus(account, { state: "offline", offlineReady: true }).key).toBe("offline");
  });

  test("requires sign-in recovery even when the last project state was synced", () => {
    const again = cloudStatus({ ...account, signInRequired: true }, synced);
    expect(again.key).toBe("signInAgain");
    expect(again.icon).toBe("user-round-key");
    const signIn = cloudStatus({ ...account, login: null }, synced);
    expect(signIn.key).toBe("signIn");
    expect(signIn.icon).toBe("user-round-key");
  });

  test("keeps an account without early access signed in", () => {
    expect(cloudStatus({ ...account, features: { relay: false } }, synced).key).toBe("signedIn");
    expect(cloudStatus({ ...account, features: null }, synced).key).toBe("signedIn");
  });

  test("shows actual pending document counts and leaves unknown counts unspecified", () => {
    expect(cloudStatus(account, { ...synced, state: "waiting-to-sync", pendingItems: 3 }).count).toBe(3);
    expect(cloudStatus(account, { ...synced, state: "waiting-to-sync" }).count).toBeUndefined();
  });

  test("does not invent download progress or claim completion before verification", () => {
    const downloading: ProjectSyncStatus = { state: "first-download-incomplete", offlineReady: false };
    expect(cloudStatus(account, downloading).percent).toBeUndefined();
    expect(cloudStatus(account, { ...downloading, download: { completed: 4, total: null } }).percent).toBeUndefined();
    expect(cloudStatus(account, { ...downloading, download: { completed: 4, total: 10 } }).percent).toBe(40);
    expect(cloudStatus(account, { ...downloading, download: { completed: 10, total: 10 } }).percent).toBeUndefined();
  });
  test("distinguishes internal work, waiting, uploads and downloads from actual source activity", () => {
    const source = {
      id: "sessions",
      phase: "record-stream:merge",
      connected: true,
      busy: true,
      downloaded: false,
      files: [],
    };
    const initial: ProjectSyncStatus = { state: "first-download-incomplete", offlineReady: false, sources: [source] };
    expect(cloudStatus(account, initial).key).toBe("checking");
    expect(cloudStatus(account, { ...initial, sources: [{ ...source, busy: false }] }).key).toBe("waiting");
    expect(cloudStatus(account, { ...initial, sources: [{ ...source, connected: false }] }).key).toBe("offline");
    const file = {
      id: "file",
      direction: "upload" as const,
      status: "active" as const,
      byteLength: 12,
      totalBytes: 40,
      completedBytes: 10,
    };
    expect(cloudStatus(account, { ...initial, sources: [{ ...source, files: [file] }] }).key).toBe("uploading");
    expect(
      cloudStatus(account, { ...initial, sources: [{ ...source, files: [{ ...file, direction: "download" }] }] }).key,
    ).toBe("downloading");
  });
});
