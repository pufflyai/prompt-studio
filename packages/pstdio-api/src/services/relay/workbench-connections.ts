import type { RelayWorkbench } from "./runtime";

/** One background connection per synced workbench, such as a core owner that every project has. */
export const createWorkbenchConnections = <T extends { done: Promise<unknown>; close: () => void }>(
  start: (config: RelayWorkbench) => T,
) => {
  const connections = new Map<string, T>();
  return {
    get: (id: string) => connections.get(id),
    ensure(config: RelayWorkbench) {
      if (!connections.has(config.workbenchId)) connections.set(config.workbenchId, start(config));
    },
    async remove(id: string) {
      const connection = connections.get(id);
      connection?.close();
      await connection?.done;
      connections.delete(id);
    },
    close() {
      for (const connection of connections.values()) connection.close();
    },
    done: () => Promise.all([...connections.values()].map((connection) => connection.done)),
  };
};
