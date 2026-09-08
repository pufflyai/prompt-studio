import { useEffect, useRef, useState } from "react";

// Prototype resize state for one collapsible panel. Dragging past the minimum
// size collapses the panel. Dragging a collapsed panel open again snaps it to
// its minimum size.

interface PrototypePanelSizeConfig {
  initial: number;
  min: number;
  max: number;
  // +1 when moving the separator along the axis grows the panel, -1 when it shrinks it.
  direction: 1 | -1;
  collapsed: boolean;
}

const COLLAPSE_BELOW_MIN_PX = 48;
const OPEN_AFTER_PX = 24;
const KEYBOARD_STEP_PX = 24;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const usePrototypePanelSize = (config: PrototypePanelSizeConfig) => {
  const { initial, min, max, direction, collapsed: initialCollapsed } = config;
  const [size, setSize] = useState(initial);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const dragStartRef = useRef({ size: initial, collapsed: initialCollapsed });

  // Storybook controls change the prop without remounting the story.
  useEffect(() => setCollapsed(initialCollapsed), [initialCollapsed]);

  const startDrag = () => {
    dragStartRef.current = { size, collapsed };
  };

  const drag = (deltaPx: number) => {
    const start = dragStartRef.current;
    const raw = (start.collapsed ? 0 : start.size) + deltaPx * direction;
    const threshold = start.collapsed ? OPEN_AFTER_PX : min - COLLAPSE_BELOW_MIN_PX;

    if (raw < threshold) {
      setCollapsed(true);
      return;
    }

    setCollapsed(false);
    setSize(clamp(raw, min, max));
  };

  const step = (forward: boolean) => {
    startDrag();
    drag(forward ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX);
  };

  const toggle = () => setCollapsed((value) => !value);

  return { size, collapsed, startDrag, drag, step, toggle };
};
