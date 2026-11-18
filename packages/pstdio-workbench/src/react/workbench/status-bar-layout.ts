import { useLayoutEffect, useRef, useState } from "react";
import type { WorkbenchStatusBarItem, WorkbenchStatusBarSlot } from "../../core";

export const statusBarSlots = ["leading", "center", "trailing"] as const;
export const statusBarSlotLabels = { leading: "left", center: "center", trailing: "right" };

export interface StatusBarDrop {
  slot: WorkbenchStatusBarSlot;
  id?: string;
  edge?: "before" | "after";
}

type StatusBarPlacement = Pick<WorkbenchStatusBarItem, "id" | "slot">;
interface StatusBarGeometry {
  width: number;
  gap: number;
  widths: Record<string, number>;
}

export const projectStatusBarDrop = (items: readonly StatusBarPlacement[], id: string, drop: StatusBarDrop) => {
  const dragged = items.find((item) => item.id === id);
  if (!dragged) return;
  if (drop.id === id) return items;
  const remaining = items.filter((item) => item.id !== id);
  const moved = { ...dragged, slot: drop.slot };
  if (!drop.id) return [...remaining, moved];
  const target = remaining.findIndex((item) => item.id === drop.id && item.slot === drop.slot);
  if (target < 0) return;
  remaining.splice(target + Number(drop.edge === "after"), 0, moved);
  return remaining;
};

export const calculateStatusBarLayout = (items: readonly StatusBarPlacement[], geometry: StatusBarGeometry) => {
  const offsets: Record<string, number> = {};
  const groups = statusBarSlots.map((slot) => {
    const group = items.filter((item) => item.slot === slot);
    const width =
      group.reduce((sum, item) => sum + (geometry.widths[item.id] ?? 0), 0) +
      Math.max(0, group.length - 1) * geometry.gap;
    return { slot, group, width };
  });
  const width = Math.max(
    geometry.width,
    groups.reduce((sum, group) => sum + group.width, 0) +
      Math.max(0, groups.filter((group) => group.group.length).length - 1) * geometry.gap,
  );
  const leadingEnd = groups[0]!.width + (groups[0]!.group.length ? geometry.gap : 0);
  const trailingStart = width - groups[2]!.width - (groups[2]!.group.length ? geometry.gap : 0);
  for (const { slot, group, width: groupWidth } of groups) {
    let left = 0;
    if (slot === "center") left = Math.max(leadingEnd, Math.min((width - groupWidth) / 2, trailingStart - groupWidth));
    if (slot === "trailing") left = width - groupWidth;
    for (const item of group) {
      offsets[item.id] = left;
      left += (geometry.widths[item.id] ?? 0) + geometry.gap;
    }
  }
  return { offsets, width };
};

/** Keep widget nodes in place while rendering a preview of the destination. */
export const useStatusBarLayout = (items: WorkbenchStatusBarItem[], activeId?: string, drop?: StatusBarDrop) => {
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<StatusBarGeometry>({ width: 0, gap: 0, widths: {} });
  const ids = JSON.stringify(items.map((item) => item.id));
  useLayoutEffect(() => {
    const node = root.current;
    const container = viewport.current;
    if (!node || !container) return;
    const measure = () => {
      const widths: Record<string, number> = {};
      for (const child of node.querySelectorAll<HTMLElement>("[data-status-bar-item]")) {
        widths[child.dataset.statusBarItem!] = child.getBoundingClientRect().width;
      }
      const width = container.clientWidth;
      const gap = Number.parseFloat(getComputedStyle(node).columnGap) || 0;
      setGeometry((previous) => {
        if (
          previous.width === width &&
          previous.gap === gap &&
          Object.keys(previous.widths).length === Object.keys(widths).length &&
          Object.entries(widths).every(([id, size]) => previous.widths[id] === size)
        )
          return previous;
        return { width, gap, widths };
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(container);
    const active = new Set<string>(JSON.parse(ids));
    for (const child of node.querySelectorAll<HTMLElement>("[data-status-bar-item]")) {
      if (active.has(child.dataset.statusBarItem!)) observer.observe(child);
    }
    measure();
    return () => observer.disconnect();
  }, [ids]);
  const layout = calculateStatusBarLayout(items, geometry);
  const projected = activeId && drop ? projectStatusBarDrop(items, activeId, drop) : undefined;
  const preview = projected ? calculateStatusBarLayout(projected, geometry) : undefined;
  const placeholder =
    preview && activeId ? { left: preview.offsets[activeId], width: geometry.widths[activeId] ?? 0 } : undefined;
  return { root, viewport, ...layout, preview, placeholder };
};
