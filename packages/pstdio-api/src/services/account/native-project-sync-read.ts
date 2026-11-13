import type { ProjectSyncStatus } from "pstdio-api-contracts";
import { type DeviceReadIdentity, matchesDeviceAccount } from "./native-device-read";
import type { DeviceLogin } from "./native-store";
import { recoveringProjectSyncStatus } from "./project-sync-readiness";

export const connectionSyncStatus = async (
  projectId: string,
  login: DeviceLogin | null,
  projectsFor: (login: DeviceLogin | null) => string[] | undefined,
  projectStatus: (projectId: string) => Promise<ProjectSyncStatus>,
  missing: { recovering(projectId: string): boolean },
): Promise<ProjectSyncStatus> => {
  const projects = projectsFor(login);
  if (login && !projects) return { state: "offline", offlineReady: false };
  if (!projects?.includes(projectId)) return { state: "local", offlineReady: false };
  const status = await projectStatus(projectId);
  return missing.recovering(projectId) ? recoveringProjectSyncStatus(status) : status;
};

/** Fence the assembled projection without acquiring or cancelling the project's recovery owner. */
export const createNativeProjectSyncReader =
  (input: {
    login(): Promise<DeviceLogin | null>;
    exists(projectId: string): Promise<unknown>;
    read(projectId: string, login: DeviceLogin | null): Promise<ProjectSyncStatus>;
    away(projectId: string): Promise<Pick<ProjectSyncStatus, "away" | "replaced">>;
    changed(): Error;
    unknown(): Error;
  }) =>
  async (projectId: string, signal?: AbortSignal, expected?: DeviceReadIdentity | null): Promise<ProjectSyncStatus> => {
    signal?.throwIfAborted();
    const login = await input.login();
    if (
      expected !== undefined &&
      (expected === null ? login !== null : !login || !matchesDeviceAccount(login, expected))
    )
      throw input.changed();
    const assertCurrent = async () => {
      signal?.throwIfAborted();
      const current = await input.login();
      signal?.throwIfAborted();
      if (
        login === null
          ? current !== null
          : !current ||
            current.token !== login.token ||
            current.deviceId !== login.deviceId ||
            !matchesDeviceAccount(current, login)
      )
        throw input.changed();
    };
    if (!(await input.exists(projectId))) throw input.unknown();
    await assertCurrent();
    const status = await input.read(projectId, login);
    await assertCurrent();
    const away = await input.away(projectId);
    await assertCurrent();
    return { ...status, ...away };
  };
