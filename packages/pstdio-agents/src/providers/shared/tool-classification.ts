import type { ToolPartActionType } from "../../types";

export type ToolBuckets = {
  read: ReadonlySet<string>;
  write: ReadonlySet<string>;
  execute: ReadonlySet<string>;
  network: ReadonlySet<string>;
};

export const classifyToolAction = (name: string, buckets: ToolBuckets): ToolPartActionType => {
  if (buckets.read.has(name)) return "read";
  if (buckets.write.has(name)) return "write";
  if (buckets.execute.has(name)) return "execute";
  if (buckets.network.has(name)) return "network";
  return "other";
};
