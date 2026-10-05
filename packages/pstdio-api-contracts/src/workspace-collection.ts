import type { DataTableRendererSettings } from "./extension-kernel/types";

/** The native Workspaces collection uses the same view identity in the UI and API. */
export const WORKSPACES_COLLECTION_ID = "dashboard-workbench.workspaces";
export const workspaceCollectionColumns = [
  { id: "name", label: "Name", type: "string" },
  { id: "type", label: "Type", type: "string", groupable: true },
  { id: "location", label: "Location", type: "string" },
  { id: "created", label: "Created at", type: "date" },
  { id: "diff", label: "Diff", type: "number", filterable: false },
  { id: "attempt", label: "Attempt", type: "string" },
  { id: "provider", label: "Provider", type: "string" },
  { id: "state", label: "State", type: "string", groupable: true },
  { id: "error", label: "Provider error", type: "string" },
  { id: "branch", label: "Branch", type: "string" },
  { id: "updated", label: "Updated at", type: "date" },
] satisfies {
  id: string;
  label: string;
  type: "string" | "number" | "date";
  groupable?: boolean;
  filterable?: boolean;
}[];

// Diagnostic fields stay available from Display without crowding the default list.
export const workspaceCollectionDefaults: Partial<DataTableRendererSettings> = {
  showStats: false,
  hiddenColumns: ["attempt", "provider", "state", "error", "branch", "updated"],
};
