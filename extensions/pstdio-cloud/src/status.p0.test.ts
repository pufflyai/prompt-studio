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
  test("distinguishes a local project from a disconnected cloud project", () => {
    expect(cloudStatus(account, { state: "local", offlineReady: true }).key).toBe("local");
    expect(cloudStatus(account, { state: "offline", offlineReady: true }).key).toBe("offline");
  });

  test("requires sign-in recovery even when the last project state was synced", () => {
    expect(cloudStatus({ ...account, signInRequired: true }, synced).key).toBe("signInAgain");
    expect(cloudStatus({ ...account, login: null }, synced).key).toBe("signIn");
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
});
