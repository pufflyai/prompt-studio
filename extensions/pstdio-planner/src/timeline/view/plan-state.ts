// Keep transient selection, collapsing, and drag operations outside the composed page.
import { useEffect, useState } from "react";
import type { Plan, PlanRow } from "../contracts";
import { buildTracks } from "../model/tracks";
import type { DropTarget } from "./drag";
import type { Relation } from "./plan-view";
import type { PlanClient } from "./use-plan";

export function relationsFor(selected: PlanRow | undefined, plan: Plan | undefined) {
  const relations = new Map<string, Relation>();
  const rows = new Map(plan?.sections.flatMap(({ rows }) => rows).map((row) => [row.id, row]));
  const walk = (id: string, direction: "dependsOn" | "blocks", relation: Relation) => {
    const pending = [...(rows.get(id)?.[direction] ?? [])];
    const visited = new Set<string>([id]);
    while (pending.length) {
      const next = pending.pop();
      if (!next || visited.has(next.id)) {
        continue;
      }
      visited.add(next.id);
      relations.set(next.id, relation);
      pending.push(...(rows.get(next.id)?.[direction] ?? []));
    }
  };

  if (selected) {
    walk(selected.id, "dependsOn", "needed-first");
    walk(selected.id, "blocks", "waits-on-selected");
    relations.set(selected.id, "selected");
  }

  return relations;
}

export function useDragAndDrop(client: PlanClient, onError: (error: string) => void) {
  const [dragId, setDragId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<DropTarget>();
  // A drag cancelled with Escape or released outside a target ends without a drop.
  useEffect(() => {
    const end = () => {
      setDragId(undefined);
      setDropTarget(undefined);
    };
    document.addEventListener("dragend", end);
    return () => document.removeEventListener("dragend", end);
  }, []);
  const drop = async () => {
    const target = dropTarget;
    setDragId(undefined);
    setDropTarget(undefined);
    if (!dragId || !target || target.beforeId === dragId) {
      return;
    }
    try {
      if (target.trackId !== undefined) {
        await client.commands["timeline.track.assign"]({ ticket: dragId, track: target.trackId ?? "none" });
      }

      await client.commands["timeline.plan.move"]({
        ticket: dragId,
        deadline: target.deadlineId ?? "none",
        before: target.beforeId,
      });
    } catch (reason) {
      onError(String(reason));
    }
  };

  return { dragId, dropTarget: dragId ? dropTarget : undefined, setDragId, setDropTarget, drop };
}

export function useViewSections(plan: Plan | undefined, visibleTicketIds: ReadonlySet<string>) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string | null) =>
    setCollapsed((current) => {
      const next = new Set(current);
      const key = id ?? "none";
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  const shown = plan?.sections ?? [];
  const sections = shown.map((section) => ({
    section,
    rows: section.rows.filter((row) => visibleTicketIds.has(row.id)),
    collapsed: collapsed.has(section.deadline?.id ?? "none"),
  }));
  const tracks = buildTracks(plan?.trackProperty, plan?.sections.flatMap(({ rows }) => rows) ?? []);
  return { shown, sections, tracks, toggle };
}
