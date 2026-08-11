import type { SyncedRow } from "@/lib/sync/collections";

export interface DashboardResourceAnchor {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isResourceAnchor = (value: unknown): value is DashboardResourceAnchor =>
  isRecord(value) && typeof value.type === "string" && typeof value.id === "string";

// Sessions and workspaces both carry `anchors_json`: the domain resources they belong to.
export const findResourceAnchor = (row: SyncedRow, type: string) => {
  const anchors = row.anchors_json;
  if (!Array.isArray(anchors)) return undefined;

  return anchors.find((anchor): anchor is DashboardResourceAnchor => isResourceAnchor(anchor) && anchor.type === type);
};
