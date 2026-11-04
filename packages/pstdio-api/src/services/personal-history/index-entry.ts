import type { PersonalIndexDelta } from "pstdio-db";
import type { Json } from "pstdio-sync-contracts";

export const personalIndexKinds = ["sessions", "workspaces", "workspace_sessions", "queues"] as const;
export const readPersonalIndexDelta = (value: Json, writerId: string, accountId: string) => {
  const delta = value as unknown as PersonalIndexDelta;
  if (
    !delta ||
    typeof delta !== "object" ||
    typeof delta.deviceId !== "string" ||
    typeof delta.id !== "string" ||
    ![...personalIndexKinds, "heads", "publications"].includes(delta.kind as (typeof personalIndexKinds)[number]) ||
    (delta.value !== null && (typeof delta.value !== "object" || Array.isArray(delta.value))) ||
    (delta.seedId !== undefined && (typeof delta.seedId !== "string" || !delta.seedId))
  )
    throw new Error("Invalid private history index entry");
  if (delta.seedId ? delta.seedId !== writerId : delta.deviceId !== writerId)
    throw new Error("Private index writer does not own its delta");
  if (delta.value !== null) {
    const row = delta.value as Record<string, unknown>;
    if (row.id !== delta.id) throw new Error("Private index entry identity changed");
    if (personalIndexKinds.includes(delta.kind as (typeof personalIndexKinds)[number])) {
      const device = row.device as { id?: string; ownerId?: string } | undefined;
      if (device?.id !== delta.deviceId || device.ownerId !== accountId)
        throw new Error("Private index device ownership changed");
    }
  }
  return delta;
};
