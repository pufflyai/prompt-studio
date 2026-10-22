import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { startPublishedExtensions } from "./publications";
import type { RelayWorkbench } from "./runtime";

export const createPublicationConnections = (input: {
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: (id: string) => () => Promise<{ token: string; expiresAt: string }>;
  statusChanged: (id: string) => void;
}) => {
  const connections = new Map<string, ReturnType<typeof startPublishedExtensions>>();
  return {
    get: (id: string) => connections.get(id),
    ensure(config: RelayWorkbench) {
      const id = config.workbenchId;
      if (!connections.has(id))
        connections.set(
          id,
          startPublishedExtensions({
            config,
            deps: input.deps,
            signal: input.signal,
            access: input.access(id),
            statusChanged: () => input.statusChanged(id),
          }),
        );
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
