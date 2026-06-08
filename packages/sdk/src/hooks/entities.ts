import type { Workspace } from "../resources";

export type HookResourceAnchor = {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

export type HookWorkspace = Workspace & {
  ticket_shorthand: string | null;
};
