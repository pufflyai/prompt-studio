import type { ProjectSyncStatus } from "pstdio-api-contracts";
import type { ScopedDeviceLogin } from "./native-store";
import type { createProjectCopyStore, ProjectCopy } from "./project-copy-store";

type CopyDevice = Pick<ScopedDeviceLogin, "managerOrigin" | "accountId" | "userId" | "deviceId">;

export const deviceProjectCopyKey = (device: CopyDevice, projectId: string) =>
  JSON.stringify([device.managerOrigin, device.accountId, device.userId, device.deviceId, projectId]);

export const requestManualCopy = async (
  copies: ReturnType<typeof createProjectCopyStore>,
  folderErrors: Map<string, string>,
  choice?: ProjectCopy,
) => {
  if (!choice) return;
  folderErrors.delete(deviceProjectCopyKey(choice, choice.projectId));
  if (choice.automatic || choice.phase === "cloud-only")
    await copies.write({ ...choice, phase: "downloading", automatic: undefined });
};

export const createCopyRetries = (input: {
  refresh(): Promise<void>;
  local(id: string): Promise<unknown>;
  retry(id: string, requireCurrent: () => Promise<void>): Promise<void>;
  requireCurrent(login: ScopedDeviceLogin, id: string): Promise<void>;
  changed?(): void;
}) => {
  const pending = new Set<string>();
  return {
    active: (login: ScopedDeviceLogin, id: string) => pending.has(deviceProjectCopyKey(login, id)),
    start(login: ScopedDeviceLogin, id: string) {
      const key = deviceProjectCopyKey(login, id);
      const requireCurrent = () => input.requireCurrent(login, id);
      pending.add(key);
      void input
        .refresh()
        .then(async () => {
          if (!(await input.local(id))) return;
          await requireCurrent();
          await input.retry(id, requireCurrent);
        })
        .catch(() => {})
        .finally(() => {
          pending.delete(key);
          input.changed?.();
        });
    },
  };
};

export const fenceCopySyncStatus = async (
  id: string,
  login: ScopedDeviceLogin | null,
  read: () => Promise<ProjectSyncStatus>,
  copies: ReturnType<typeof createProjectCopyStore>,
  retries: ReturnType<typeof createCopyRetries>,
) => {
  const pending = login && retries.active(login, id);
  const status = await read();
  if (!login) return status;
  if (status.state === "needs-attention" && (pending || retries.active(login, id)))
    return { ...status, state: "first-download-incomplete" as const, offlineReady: false };
  if (status.state !== "local") return status;
  const choice = (await copies.forAccount(login)).find((row) => row.projectId === id);
  return choice?.phase === "downloading"
    ? { state: "first-download-incomplete" as const, offlineReady: false }
    : status;
};
