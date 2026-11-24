import type { ResourceAnchor, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { legacyResourceOwner } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";
import { apiLogger } from "../lib/logger";

export const publishResourceAnchorChanges = (
  bus: EventBus,
  items: Array<{ source: ResourceRef; target: ResourceAnchor }>,
  operation: "add" | "remove",
) => {
  if (!items.length) return;
  try {
    bus.emit("resource_anchor_events", "set", {
      id: crypto.randomUUID(),
      projectId: items[0]!.source.projectId,
      operation,
      items,
    });
  } catch (err) {
    apiLogger.warn({ err, event: "resource_anchors.publish_failed" }, "Could not publish committed resource links");
  }
};

export const publishCreatedResourceAnchors = (
  bus: EventBus,
  kind: "workspace" | "session",
  row: { id: string; project_id: string | null; anchors_json: ResourceAnchor[] },
) => {
  publishResourceAnchorChanges(
    bus,
    row.anchors_json.map((anchor) => ({
      source: { type: kind, id: row.id, projectId: row.project_id!, extensionId: "pstdio" },
      target: {
        ...anchor,
        projectId: row.project_id!,
        extensionId: legacyResourceOwner(anchor),
        role: anchor.role ?? "context",
      },
    })),
    "add",
  );
};

export const refreshResourceAnchorEndpoints = async (
  bus: EventBus,
  items: Array<{ source: ResourceRef; target: ResourceAnchor }>,
  readers: Partial<
    Record<
      "project" | "workspace" | "session",
      (id: string) => Promise<{ id: string; deleted_at?: string | null } | null>
    >
  >,
) => {
  const sources = new Map(
    items
      .flatMap(({ source, target }) => [source, target])
      .filter((ref) => ref.extensionId === "pstdio")
      .map((ref) => [JSON.stringify([ref.type, ref.id]), ref]),
  );
  for (const source of sources.values()) {
    if (source.type !== "project" && source.type !== "workspace" && source.type !== "session") continue;
    const read = readers[source.type];
    if (!read) continue;
    try {
      const row = await read(source.id);
      if (row && !("deleted_at" in row && row.deleted_at)) bus.emit(`${source.type}s`, "set", row);
    } catch (err) {
      // Endpoint refreshes follow the committed edge write. Continue refreshing the remaining endpoints.
      apiLogger.warn(
        { err, event: "resource_anchors.endpoint_refresh_failed", kind: source.type },
        "Could not refresh a linked resource",
      );
    }
  }
};
