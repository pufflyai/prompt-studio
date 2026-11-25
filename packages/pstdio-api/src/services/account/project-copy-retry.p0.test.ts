import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectSyncStatus } from "pstdio-api-contracts";
import { scopeDeviceLogin } from "./native-store";
import { createProjectCloudCatalog } from "./project-cloud-catalog";
import { createProjectCopyStore } from "./project-copy-store";

const until = async (ready: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!ready() && Date.now() < deadline) await Bun.sleep(5);
  return ready();
};

test.each([
  [true, false, "needs-attention"],
  [false, false, "needs-attention"],
  [true, true, "needs-attention"],
  [true, false, "first-download-incomplete"],
  [false, false, "first-download-incomplete"],
  [true, true, "first-download-incomplete"],
  [true, false, "offline"],
  [false, false, "offline"],
  [true, true, "offline"],
] as const)("copy retry holds its scope through refresh and restart (stored: %j, team: %j, state: %s)", async (storedCopy, team, failedState) => {
  const root = await mkdtemp(join(tmpdir(), "project-copy-retry-"));
  const accountFile = join(root, "account.json");
  const copies = createProjectCopyStore(accountFile);
  const login = {
    managerOrigin: "https://accounts.example.test",
    relayOrigin: "https://relay.example.test",
    accountId: "account",
    deviceId: "device",
    token: "fixture-credential",
  };
  let teamGrant = true;
  const copyLogin = scopeDeviceLogin(login, team ? "team" : undefined);
  const id = "example-project";
  const project = {
    id,
    name: "Example",
    shorthand: "EX",
    default_agent_id: null,
    default_agent_model: null,
    startup_script: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: null,
  };
  let finishRefresh = Promise.withResolvers<void>();
  let released = false;
  const finishRetry = Promise.withResolvers<void>();
  let attempts = 0;
  let refreshes = 0;
  let holdRefresh = false;
  let status: ProjectSyncStatus = { state: "needs-attention", offlineReady: false };
  const catalog = createProjectCloudCatalog({
    accountFile,
    login: async () => login,
    projectLogin: async (actor) => scopeDeviceLogin(actor, team ? "team" : undefined),
    cloud: (actor) => {
      if (team && !teamGrant) return;
      return {
        ...actor,
        credential: login.token,
        ids: [id],
        features: { relay: true },
        projectDeletion: false,
        deletions: [],
      };
    },
    changed: () => {
      released = true;
    },
    projects: { get: async () => project },
    online: () => true,
    syncStatus: async () => status,
    returnedUploadState: async () => "verified",
    call: async () => {
      throw new Error("Unexpected manager call");
    },
    async refresh() {
      refreshes++;
      if (!holdRefresh) return;
      await finishRefresh.promise;
    },
    async retry() {
      attempts++;
      await finishRetry.promise;
    },
  });
  const catalogForCopy = () => catalog.catalogProjects(team ? copyLogin.accountId : undefined, login);
  const download = () =>
    catalog.downloadCloudProject(id, { accountId: copyLogin.accountId, managerOrigin: copyLogin.managerOrigin }, login);
  const canDownload = async () => (await catalogForCopy()).projects[0]?.actions.download;
  const activeState = failedState === "needs-attention" ? "first-download-incomplete" : failedState;
  try {
    if (storedCopy)
      await copies.write({
        managerOrigin: login.managerOrigin,
        accountId: copyLogin.accountId,
        userId: copyLogin.userId,
        deviceId: login.deviceId,
        projectId: id,
        name: project.name,
        phase: "downloading",
        automatic: true,
      });
    status = { ...status, state: activeState };
    expect(await download()).toEqual({ projectId: id, presence: "downloading" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect({ attempts, refreshes }).toEqual({ attempts: 0, refreshes: 1 });
    if (storedCopy) expect((await copies.forAccount(copyLogin))[0]?.automatic).toBeUndefined();
    status = {
      ...status,
      state: failedState,
      sources:
        failedState === "needs-attention"
          ? undefined
          : [
              {
                id: "core",
                phase: "retrying",
                connected: false,
                busy: false,
                downloaded: false,
                error: "Cloud source failed; retry scheduled",
                files: [],
              },
            ],
    };
    holdRefresh = true;
    expect(await canDownload()).toBe(true);
    expect(await download()).toEqual({ projectId: id, presence: "downloading" });
    expect(await until(() => refreshes === 2)).toBe(true);
    expect(await canDownload()).toBe(false);
    expect((await catalog.fenceLocalStatus(id, login, async () => status)).state).toBe(activeState);
    expect((await catalog.fenceLocalStatus(id, { ...login, deviceId: "other" }, async () => status)).state).toBe(
      failedState,
    );
    await download();
    expect(attempts).toBe(0);
    finishRefresh.resolve();
    expect(await until(() => attempts === 1)).toBe(true);
    expect(await canDownload()).toBe(false);
    expect((await catalog.fenceLocalStatus(id, login, async () => status)).state).toBe(activeState);
    await download();
    expect(attempts).toBe(1);
    released = false;
    finishRetry.resolve();
    expect(await until(() => released)).toBe(true);
    expect(await canDownload()).toBe(true);
    expect((await catalog.fenceLocalStatus(id, login, async () => status)).state).toBe(failedState);

    if (team) {
      finishRefresh = Promise.withResolvers<void>();
      await download();
      expect(await until(() => refreshes === 3)).toBe(true);
      released = false;
      teamGrant = false;
      finishRefresh.resolve();
      expect(await until(() => released)).toBe(true);
      expect(attempts).toBe(1);
      expect(await canDownload()).toBeUndefined();
      teamGrant = true;
    }
    if (storedCopy) {
      let preparations = 0;
      catalog.connectProjectCopies({
        inspect: async () => ({ removesManagedFolder: true, providerWorkspaceCount: 0 }),
        async prepareFolder() {
          if (++preparations === 1) throw new Error("Folder cannot be prepared yet");
        },
      });
      status = { state: "synced", offlineReady: true };
      await expect(catalog.prepareDownloadedProject(id)).rejects.toThrow("Folder cannot be prepared yet");
      expect((await catalogForCopy()).projects[0]?.downloadError).toBeDefined();
      holdRefresh = false;
      await download();
      expect((await catalogForCopy()).projects[0]?.downloadError).toBeUndefined();
      await catalog.prepareDownloadedProject(id);
      expect({ preparations, attempts }).toEqual({ preparations: 2, attempts: 1 });
      expect((await catalogForCopy()).projects[0]?.presence).toBe("downloaded");
    }
  } finally {
    finishRefresh.resolve();
    finishRetry.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
