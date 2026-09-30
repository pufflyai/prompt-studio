import type { TreeAction } from "./tree-renderer-types";

export interface ViewToolbarAction extends TreeAction {
  presentation?: "primary" | "secondary";
}
