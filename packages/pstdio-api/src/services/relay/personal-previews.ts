import type { SyncSpace } from "pstdio-sync/encryption";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

/** The same captured ownership decision gates durable logs and every transient preview. */
export const createPersonalPreviews = (input: {
  owned: () => ReadonlySet<string>;
  space: () => SyncSpace | undefined;
  sessions: ExtensionsRouteDeps["sessionService"]["store"];
  publish: (id: string, space: SyncSpace) => void;
  wake: () => void;
}) => {
  const pending = new Set<string>();
  let catchup = true;
  const publish = (id: string) => {
    const space = input.space();
    if (!space || !input.owned().has(id) || !input.sessions.get(id)?.conversation) return false;
    input.publish(id, space);
    return true;
  };
  return {
    changed(id: string) {
      if (!publish(id)) pending.add(id);
    },
    admitted(previous: ReadonlySet<string>) {
      for (const id of input.owned()) if (!previous.has(id)) pending.add(id);
    },
    ready() {
      catchup = true;
      input.wake();
    },
    flush() {
      if (!input.space()) return;
      for (const id of catchup ? input.owned() : pending) publish(id);
      pending.clear();
      catchup = false;
    },
  };
};
