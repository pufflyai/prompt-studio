import { cpSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { owners, workload } from "storage-scale-fixture";
import { folderProjectInput } from "../helpers/folder-project";
import {
  type ScaleFixture,
  type ScaleRuntime,
  startNativeScaleRuntime,
  startScaleRuntime,
} from "./storage-scale-runtime";

const signIn = async (runtime: ScaleRuntime, origin: string) => {
  const login = await runtime.client.account.login(origin);
  const url = new URL(login.url);
  const callback = new URL(url.searchParams.get("callback")!);
  callback.searchParams.set("state", url.searchParams.get("state")!);
  callback.searchParams.set("code", "one-use");
  await runtime.completeLoginCallback(callback.toString());
};

export const waitScaleSynced = async (runtime: ScaleRuntime, projectId: string) => {
  while ((await runtime.client.account.projectSyncStatus(projectId)).state !== "synced") await Bun.sleep(25);
};

export const prepareScaleSyncDevices = async (
  home: string,
  remoteHome: string,
  fixture: ScaleFixture,
  environment: Record<string, string>,
  origins: { primary: string; remote: string },
  emit: (row: object) => void,
) => {
  const primary = await startScaleRuntime(home, environment);
  try {
    mkdirSync(join(remoteHome, "project"), { recursive: true });
    // The producer models another device. It is deliberately outside the receiver's CPU cgroup.
    const remote = await startNativeScaleRuntime(remoteHome, environment);
    try {
      const started = performance.now();
      await signIn(primary, origins.primary);
      await primary.client.account.syncProject(fixture.projectId);
      await waitScaleSynced(primary, fixture.projectId);
      await signIn(remote, origins.remote);
      const { environmentId } = await remote.client.runtime.environment();
      const folder = join(remoteHome, "project");
      await remote.client.projects.bindEnvironment(fixture.projectId, {
        environmentId,
        name: "Scale remote",
        initial_workspace: folderProjectInput({}, folder).initial_workspace,
      });
      for (const owner of owners(workload(fixture.kind))) {
        const name = owner.index === 9 ? "pstdio-planner" : `scale-owner-${owner.index}`;
        const source = join(home, "sources", owner.index === 9 ? "planner-source" : name);
        const relative = `.pstdio/extensions/${name}`;
        cpSync(source, join(folder, relative), {
          recursive: true,
          filter: (path) => basename(path) !== "node_modules",
        });
        await remote.client.extensions.install(fixture.projectId, {
          source: { kind: "project-folder", path: relative },
          installName: name,
        });
      }
      await waitScaleSynced(remote, fixture.projectId);
      emit({
        phase: "initial-remote-download",
        durationMs: performance.now() - started,
        configuredOwners: 10,
        expectedLiveRows: owners(workload(fixture.kind)).reduce((sum, owner) => sum + owner.rows, 0),
        startupOutsideNavigation: true,
      });
      return remote;
    } catch (error) {
      await remote.stop();
      throw error;
    }
  } finally {
    await primary.stop();
  }
};
