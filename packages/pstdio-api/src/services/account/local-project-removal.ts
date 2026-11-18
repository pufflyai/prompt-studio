import type {
  LocalRemovalPreflight,
  ProjectCopyAccount,
  ProjectSyncStatus,
  RemoveLocalProjectInput,
  RemoveLocalProjectResult,
} from "pstdio-api-contracts";
import { type LocalCleanupSummary, localRemovalPreflight } from "./local-removal-preflight";
import { AccountRequestError } from "./native-account";
import { matchesDeviceAccount } from "./native-device-read";
import type { DeviceLogin } from "./native-store";
import { type createProjectCopyStore, type ProjectCopy, projectCopyAccount } from "./project-copy-store";

export const requireProjectCopyAccount = (login: DeviceLogin, expected?: ProjectCopyAccount) => {
  if (expected && !matchesDeviceAccount(login, expected))
    throw new AccountRequestError("The active Cloud account changed. Reopen the project action to confirm again.");
};

export interface ProjectCopyHooks {
  inspect(id: string): Promise<LocalCleanupSummary>;
  prepareFolder(id: string): Promise<unknown>;
  freeze?(id: string): void;
  suspend?(id: string): void;
  hide?(id: string): void;
  release?(id: string): void;
  drain?(id: string): Promise<void>;
  cleanup?(copy: ProjectCopy): Promise<void>;
  detach?(id: string): Promise<void>;
}

export class LocalRemovalPending extends Error {
  constructor(cause: unknown) {
    super("Local cleanup is incomplete. Retry removing this project's copy.", { cause });
  }
}

type RemovalResult = { removed: RemoveLocalProjectResult } | { conflict: LocalRemovalPreflight } | null;

export const createLocalProjectRemoval = (input: {
  copies: ReturnType<typeof createProjectCopyStore>;
  login(): Promise<DeviceLogin>;
  requireCurrent(login: DeviceLogin): Promise<void>;
  isCloudProject(login: DeviceLogin, id: string): Promise<boolean>;
  project(id: string): Promise<{ id: string; name: string } | null>;
  online(): boolean;
  syncStatus(id: string): Promise<ProjectSyncStatus>;
  withdraw(id: string): Promise<void>;
  changed(): void;
}) => {
  let hooks: ProjectCopyHooks | undefined;
  const active = new Map<string, Promise<unknown>>();
  const serialize = <T>(id: string, run: () => Promise<T>) => {
    const next = (active.get(id) ?? Promise.resolve()).catch(() => {}).then(run);
    active.set(id, next);
    return next.finally(() => {
      if (active.get(id) === next) active.delete(id);
    });
  };

  const inspect = async (project: { id: string; name: string }) => {
    const [summary, status] = await Promise.all([
      hooks!.inspect(project.id),
      input.syncStatus(project.id).catch(() => undefined),
    ]);
    return localRemovalPreflight(project, summary, status, input.online());
  };

  const finish = async (copy: ProjectCopy) => {
    hooks!.suspend!(copy.projectId);
    hooks!.hide?.(copy.projectId);
    try {
      // The persisted intent prevents refresh or a restarted host from downloading while cleanup runs.
      await input.withdraw(copy.projectId);
      await hooks!.detach?.(copy.projectId);
      await hooks!.cleanup!(copy);
      await input.copies.write({ ...copy, phase: "cloud-only" });
    } catch (error) {
      throw new LocalRemovalPending(error);
    }
    hooks!.release!(copy.projectId);
    input.changed();
    return { removed: { projectId: copy.projectId, presence: "cloud-only" as const } };
  };

  const begin = async (id: string, options: RemoveLocalProjectInput): Promise<RemovalResult> => {
    if (!hooks?.freeze || !hooks.suspend || !hooks.cleanup)
      throw new AccountRequestError("Project removal is unavailable");
    const login = await input.login();
    requireProjectCopyAccount(login, options.expectedAccount);
    const choice = (await input.copies.forAccount(login)).find((row) => row.projectId === id);
    if (choice?.phase === "removing") return finish(choice);
    if (choice?.phase === "cloud-only") return { removed: { projectId: id, presence: "cloud-only" } };
    const project = (await input.isCloudProject(login, id)) && (await input.project(id));
    if (!project) return null;
    hooks.freeze(id);
    let copy: ProjectCopy;
    try {
      await hooks.drain?.(id);
      const preflight = { ...(await inspect(project)), account: projectCopyAccount(login) };
      await input.requireCurrent(login);
      if (preflight.requiresDiscard && !options.discardUnsynced) {
        hooks.release!(id);
        return { conflict: preflight };
      }
      const { managerOrigin, accountId, deviceId } = login;
      copy = {
        managerOrigin,
        accountId,
        deviceId,
        projectId: id,
        name: project.name,
        phase: "removing",
      };
      await input.copies.write(copy);
    } catch (error) {
      hooks.release!(id);
      throw error;
    }
    return finish(copy);
  };

  return {
    serialize,
    connect(next: ProjectCopyHooks) {
      hooks = next;
    },
    async preflight(id: string) {
      const login = await input.login();
      const choice = (await input.copies.forAccount(login)).find(
        (row) => row.projectId === id && row.phase === "removing",
      );
      const project = choice
        ? { id, name: choice.name }
        : (await input.isCloudProject(login, id)) && (await input.project(id));
      if (!project || !hooks) return null;
      const result = await inspect(project);
      await input.requireCurrent(login);
      // An earlier request already persisted consent before any destructive work started.
      return { ...result, account: projectCopyAccount(login), requiresDiscard: !choice && result.requiresDiscard };
    },
    remove: (id: string, options: RemoveLocalProjectInput) => serialize(id, () => begin(id, options)),
    async restoreBarrier(deviceId: string, suspend: (id: string) => void) {
      for (const copy of await input.copies.forDevice(deviceId)) if (copy.phase === "removing") suspend(copy.projectId);
    },
    async resume(deviceId: string, report: (id: string, error: unknown) => void) {
      if (!hooks?.cleanup) return;
      for (const copy of await input.copies.forDevice(deviceId)) {
        if (copy.phase !== "removing") continue;
        // A request can finish successfully while startup is reading the private store.
        await serialize(copy.projectId, async () => {
          const current = (await input.copies.forAccount(copy)).find((row) => row.projectId === copy.projectId);
          if (current?.phase === "removing") await finish(current);
        }).catch((error) => report(copy.projectId, error));
      }
    },
    async close() {
      await Promise.allSettled(active.values());
    },
  };
};
