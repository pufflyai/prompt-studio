import type { ResourceAnchor, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { legacyResourceOwner } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export const publishResourceAnchorChanges = (
  bus: EventBus,
  items: Array<{ source: ResourceRef; target: ResourceAnchor }>,
  operation: "add" | "remove",
) => {
  if (!items.length) return;
  bus.emit("resource_anchor_events", "set", {
    id: crypto.randomUUID(),
    projectId: items[0]!.source.projectId,
    operation,
    items,
  });
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

export const refreshLegacyAnchorSources = async (
  bus: EventBus,
  items: Array<{ source: ResourceRef; target: ResourceAnchor }>,
  readers: {
    workspace: (id: string) => Promise<{ id: string; deleted_at?: string | null } | null>;
    session: (id: string) => Promise<{ id: string } | null>;
  },
) => {
  const sources = new Map(
    items
      .filter(({ source }) => source.extensionId === "pstdio")
      .map(({ source }) => [JSON.stringify([source.type, source.id]), source]),
  );
  for (const source of sources.values()) {
    if (source.type !== "workspace" && source.type !== "session") continue;
    const row = await readers[source.type](source.id);
    if (row && !("deleted_at" in row && row.deleted_at))
      bus.emit(source.type === "workspace" ? "workspaces" : "sessions", "set", row);
  }
};
