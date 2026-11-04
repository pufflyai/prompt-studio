import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { capturePersonalIndex, type createPersonalContext } from "./personal-context";
import type { RelayWorkbench } from "./runtime";

/** Initial discovery scans local metadata once; later session events capture just their IDs. */
export const createPersonalIndex = (input: {
  deps: ExtensionsRouteDeps;
  config: RelayWorkbench;
  context: ReturnType<typeof createPersonalContext>;
}) => {
  let owned = new Set<string>();
  let streaming: string[] = [];
  let all = true;
  const changed = new Set<string>();
  return {
    get owned() {
      return owned;
    },
    get streaming() {
      return streaming;
    },
    invalidate() {
      all = true;
    },
    changed(id?: string) {
      if (id) changed.add(id);
      else all = true;
    },
    async capture(full: boolean) {
      const previous = owned;
      const ids = [...changed];
      changed.clear();
      const captureAll = full || all;
      all = false;
      try {
        const { deps, config, context } = input;
        const captured = await capturePersonalIndex(
          deps,
          config,
          context.history,
          context.references,
          captureAll ? undefined : ids,
        );
        if (captureAll) owned = captured;
        else {
          owned = new Set(owned);
          for (const id of ids) {
            if (captured.has(id)) owned.add(id);
            else owned.delete(id);
          }
        }
        streaming = (await context.history.readRecords("sessions"))
          .filter((row) => owned.has(String(row.id)) && row.status === "in_progress")
          .map((row) => String(row.id));
        return previous;
      } catch (error) {
        all = true;
        throw error;
      }
    },
  };
};
