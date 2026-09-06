import { runWorkbenchEffect } from "../workbench-effect";

let depth = 0;
const pending = new Map<object, () => void>();

export const notifyWorkbenchChange = (owner: object, notify: () => void) => {
  if (depth === 0) {
    runWorkbenchEffect("store subscriber", notify);
    return;
  }
  if (!pending.has(owner)) pending.set(owner, notify);
};

/** Commit related stores before their subscribers read the resulting workbench state. */
export const batchWorkbenchChanges = <Result>(commit: () => Result) => {
  depth++;
  try {
    return commit();
  } finally {
    depth--;
    if (depth === 0) {
      depth++;
      try {
        while (pending.size) {
          const [owner, notify] = pending.entries().next().value!;
          pending.delete(owner);
          runWorkbenchEffect("store subscriber", notify);
        }
      } finally {
        depth--;
      }
    }
  }
};
