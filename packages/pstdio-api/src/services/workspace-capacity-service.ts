import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname } from "node:path";
import { updateWorkspaceCapacityInputSchema } from "pstdio-api-contracts";

export const createWorkspaceCapacityService = (deps: {
  path: string;
  deviceId: string;
  activeWorkspaceIds: () => Promise<string[]>;
  onCapacityAvailable: () => Promise<void>;
}) => {
  const readLimit = async () => {
    try {
      return updateWorkspaceCapacityInputSchema.parse(JSON.parse(await readFile(deps.path, "utf8"))).limit;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  };
  const get = async () => ({
    deviceId: deps.deviceId,
    deviceName: hostname(),
    activeCount: (await deps.activeWorkspaceIds()).length,
    limit: await readLimit(),
  });
  let writes = Promise.resolve();
  const update = async (input: { limit: number | null }) => {
    const value = updateWorkspaceCapacityInputSchema.parse(input);
    const writing = writes.then(async () => {
      await mkdir(dirname(deps.path), { recursive: true });
      const temporary = `${deps.path}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
      await rename(temporary, deps.path);
    });
    writes = writing.catch(() => {});
    await writing;
    await deps.onCapacityAvailable();
    return get();
  };
  const hasCapacity = async (workspaceId?: string) => {
    const limit = await readLimit();
    if (limit === null) return true;
    const active = await deps.activeWorkspaceIds();
    return Boolean(workspaceId && active.includes(workspaceId)) || active.length < limit;
  };
  return { get, update, hasCapacity };
};
