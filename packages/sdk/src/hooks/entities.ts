import type { Workspace } from "../resources";

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type HookResourceAnchor = {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type HookWorkspace = Workspace;
