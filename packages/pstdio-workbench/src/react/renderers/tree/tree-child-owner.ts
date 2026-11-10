import { isScopedQueryCancellation } from "@pstdio/sdk/extensions";
import type { TreeNode } from "../../../core";
import { TreeContinuationCancelled } from "./tree-continuation-reads";

type Load = (node: TreeNode, signal: AbortSignal) => Promise<TreeNode[]>;
/** Later-page lazy folders obey the same snapshot and shared-owner rules as first-page folders. */
export const createTreeChildOwner = (input: {
  node(id: string): TreeNode | undefined;
  loaded(id: string): boolean;
  signal(): AbortSignal;
  available(): boolean;
  read(id: string, load: (signal: AbortSignal) => Promise<TreeNode[]>, signal: AbortSignal): Promise<TreeNode[]>;
  accept(id: string, nodes: TreeNode[]): void;
  onCancelled(): void;
}) => {
  const running = new Map<string, Promise<void>>();
  const failures = new Set<string>();
  return {
    load(id: string, load: Load, retry = true) {
      const pending = running.get(id);
      if (pending) return pending;
      const signal = input.signal();
      const node = input.node(id);
      if (signal.aborted || !input.available() || !node || input.loaded(id) || (!retry && failures.has(id)))
        return Promise.resolve();
      let cancelled = false;
      const job = input
        .read(id, (signal) => load(node, signal), signal)
        .then(
          (nodes) => {
            if (!signal.aborted && signal === input.signal() && input.available()) input.accept(id, nodes);
          },
          (error) => {
            if (error instanceof TreeContinuationCancelled) {
              cancelled = true;
              return;
            }
            if (signal.aborted || signal !== input.signal() || isScopedQueryCancellation(error)) return;
            failures.add(id);
            throw error;
          },
        )
        .finally(() => {
          running.delete(id);
          if (cancelled && !signal.aborted && signal === input.signal() && input.available()) input.onCancelled();
        });
      running.set(id, job);
      return job;
    },
  };
};
