import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectSyncStatus } from "pstdio-api-contracts";
import { createProjectCloudCatalog } from "./project-cloud-catalog";
import { createProjectCopyStore } from "./project-copy-store";

test.each([
  true,
  false,
])("copy retry keeps the old failure unavailable through native refresh and restart (stored copy: %s)", async (storedCopy) => {
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
  const refreshStarted = Promise.withResolvers<void>();
  const finishRefresh = Promise.withResolvers<void>();
  const retryStarted = Promise.withResolvers<void>();
  const finishRetry = Promise.withResolvers<void>();
  let attempts = 0;
  let refreshes = 0;
  let holdRefresh = false;
  let status: ProjectSyncStatus = { state: "needs-attention", offlineReady: false };
  const catalog = createProjectCloudCatalog({
    accountFile,
    login: async () => login,
    cloud: () => ({
      ...login,
      credential: login.token,
      ids: [id],
      features: { relay: true },
      projectDeletion: false,
      deletions: [],
    }),
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
      refreshStarted.resolve();
      await finishRefresh.promise;
    },
    async retry() {
      attempts++;
      retryStarted.resolve();
      await finishRetry.promise;
    },
  });
  const canDownload = async () => (await catalog.catalogProjects()).projects[0]?.actions.download;
  try {
    if (storedCopy)
      await copies.write({
        managerOrigin: login.managerOrigin,
        accountId: login.accountId,
        deviceId: login.deviceId,
        projectId: id,
        name: project.name,
        phase: "downloading",
        automatic: true,
      });
    status = { ...status, state: "first-download-incomplete" };
    expect(await catalog.downloadCloudProject(id)).toEqual({ projectId: id, presence: "downloading" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect({ attempts, refreshes }).toEqual({ attempts: 0, refreshes: 1 });
    if (storedCopy) expect((await copies.forAccount(login))[0]?.automatic).toBeUndefined();
    status = { ...status, state: "needs-attention" };
    holdRefresh = true;
    expect(await canDownload()).toBe(true);
    expect(await catalog.downloadCloudProject(id)).toEqual({ projectId: id, presence: "downloading" });
    await refreshStarted.promise;
    expect(await canDownload()).toBe(false);
    expect((await catalog.fenceLocalStatus(id, login, async () => status)).state).toBe("first-download-incomplete");
    expect((await catalog.fenceLocalStatus(id, { ...login, deviceId: "other" }, async () => status)).state).toBe(
      "needs-attention",
    );
    await catalog.downloadCloudProject(id);
    expect(attempts).toBe(0);
    finishRefresh.resolve();
    await retryStarted.promise;
    expect(await canDownload()).toBe(false);
    expect((await catalog.fenceLocalStatus(id, login, async () => status)).state).toBe("first-download-incomplete");
    await catalog.downloadCloudProject(id);
    expect(attempts).toBe(1);
    finishRetry.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(await canDownload()).toBe(true);
    expect((await catalog.fenceLocalStatus(id, login, async () => status)).state).toBe("needs-attention");

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
      expect((await catalog.catalogProjects()).projects[0]?.downloadError).toBeDefined();
      holdRefresh = false;
      await catalog.downloadCloudProject(id);
      expect((await catalog.catalogProjects()).projects[0]?.downloadError).toBeUndefined();
      await catalog.prepareDownloadedProject(id);
      expect({ preparations, attempts }).toEqual({ preparations: 2, attempts: 1 });
      expect((await catalog.catalogProjects()).projects[0]?.presence).toBe("downloaded");
    }
  } finally {
    finishRefresh.resolve();
    finishRetry.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
