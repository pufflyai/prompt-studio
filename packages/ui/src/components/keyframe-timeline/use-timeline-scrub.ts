import { type PointerEvent, type RefObject, useRef } from "react";

interface TimelineScrubProps {
  ruler: RefObject<HTMLDivElement | null>;
  playheadHandle: RefObject<HTMLDivElement | null>;
  duration: number;
  onSeek: (time: number) => void;
}

export const useTimelineScrub = (props: TimelineScrubProps) => {
  const { ruler, playheadHandle, duration, onSeek } = props;
  const drag = useRef<{ left: number; width: number } | null>(null);
  const seek = (x: number) => {
    if (drag.current) onSeek(((x - drag.current.left) / drag.current.width) * duration);
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !ruler.current) return;
      // Portaled context-menu events bubble through React, but belong to the menu surface.
      if (!event.currentTarget.contains(event.target as Node)) return;
      // Keys, group buttons and loop handles retain ownership of their gestures.
      const control = (event.target as Element).closest("button, [role=slider]");
      const line = playheadHandle.current?.getBoundingClientRect();
      const groupLine =
        control?.hasAttribute("data-timeline-group") &&
        line &&
        event.clientX >= line.left &&
        event.clientX <= line.right;
      if (control && control !== ruler.current && !groupLine) return;
      const bounds = ruler.current.getBoundingClientRect();
      if (!bounds.width) return;
      drag.current = { left: bounds.left, width: bounds.width };
      event.preventDefault();
      ruler.current.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      seek(event.clientX);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event.clientX);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: () => {
      drag.current = null;
    },
  };
};
