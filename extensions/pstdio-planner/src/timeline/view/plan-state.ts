// Keep transient selection, collapsing, and drag operations outside the composed page.
import { useEffect, useState } from "react";
import type { Plan, PlanRow } from "../contracts";
import { filterSections } from "../model/filter";
import { type DropTarget, sameTarget } from "./drag";
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

export function useDragAndDrop(client: PlanClient) {
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
    } catch {
      // The command bridge reports the rejected action in host chrome.
    }
  };

  // Dropping a ticket before itself changes nothing, so that target shows no preview.
  const preview = dragId && dropTarget?.beforeId !== dragId ? dropTarget : undefined;
  // Drag-over repeats the same target while the pointer rests, so keep the state when nothing changed.
  const target = (next: DropTarget) => setDropTarget((current) => (sameTarget(current, next) ? current : next));
  return { dragId, dropTarget: preview, setDragId, setDropTarget: target, drop };
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
  const sections = (plan ? filterSections(plan, visibleTicketIds) : []).map((section) => ({
    section,
    rows: section.rows,
    collapsed: collapsed.has(section.deadline?.id ?? "none"),
  }));
  return { shown, sections, toggle };
}
