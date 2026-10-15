import { Box } from "@chakra-ui/react";
import { type BubbleAnchor, BubbleButton, BubbleTarget } from "@pstdio/ui";
import { MessageCircle } from "lucide-react";
import { type PointerEvent, type ReactNode, type RefObject, useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import {
  type FloatingBubblePosition,
  floatingBubbleAnchor,
  floatingBubblePositions,
  nextFloatingBubblePosition,
} from "../../core/controllers/side-panel/floating-bubble-position";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface FloatingBubbleProps {
  workbench: WorkbenchCore;
  open: boolean;
  icon?: ReactNode;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
}

interface BubbleDrag {
  x: number;
  y: number;
  moved: boolean;
  button: HTMLButtonElement;
}

export const FloatingBubble = (props: FloatingBubbleProps) => {
  const { workbench, open, icon, buttonRef, onOpen } = props;
  const position = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getBubblePosition());
  const anchor = floatingBubbleAnchor(position)!;
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<BubbleDrag | undefined>(undefined);
  const suppressClick = useRef(false);
  const keyboardStart = useRef<FloatingBubblePosition | undefined>(undefined);
  const [nearest, setNearest] = useState<BubbleAnchor | undefined>();
  const nearestRef = useRef<BubbleAnchor | undefined>(undefined);
  const save = (value: FloatingBubblePosition) => {
    void runUserAction(workbench, "Move floating bubble", () =>
      workbench.commands.executeCommand("workbench.setFloatingBubblePosition", value),
    );
  };
  const cancel = () => {
    const current = drag.current;
    drag.current = undefined;
    current?.button.style.removeProperty("translate");
    suppressClick.current = Boolean(current);
    setNearest(undefined);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const x = event.clientX - current.x;
    const y = event.clientY - current.y;
    if (!current.moved && Math.hypot(x, y) < 4) return;
    current.moved = true;
    // Pointer geometry is transient. Do not restart an animation for every move.
    current.button.style.setProperty("translate", `${x}px ${y}px`);
    let distance = Infinity;
    let candidate = anchor;
    for (const target of surface.current?.querySelectorAll<HTMLElement>("[data-bubble-target]") ?? []) {
      const rect = target.getBoundingClientRect();
      const next = Math.hypot(event.clientX - rect.x - rect.width / 2, event.clientY - rect.y - rect.height / 2);
      if (next < distance) {
        candidate = target.dataset.bubbleTarget as BubbleAnchor;
        distance = next;
      }
    }
    nearestRef.current = candidate;
    setNearest(candidate);
  };
  const label = "Open Side Panel";
  return (
    <Box ref={surface} data-floating-bubble-surface position="absolute" inset="0" pointerEvents="none" zIndex="popover">
      {Object.keys(floatingBubblePositions).map((name) => (
        <BubbleTarget
          key={name}
          anchor={name as BubbleAnchor}
          nearest={name === nearest}
          active={nearest !== undefined}
        />
      ))}
      <BubbleButton
        ref={buttonRef}
        anchor={anchor}
        isOpen={open}
        isDragging={nearest !== undefined}
        aria-label={label}
        aria-description="Drag to move. Arrow keys change the anchor. Home returns to bottom right. Escape cancels movement."
        tooltip={label}
        containerProps={{ position: "absolute", pointerEvents: "auto", "data-bubble-anchor": anchor }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          suppressClick.current = false;
          keyboardStart.current = undefined;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, moved: false, button: event.currentTarget };
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          if (!drag.current) return;
          const moved = drag.current.moved;
          const target = nearestRef.current;
          cancel();
          suppressClick.current = moved;
          if (moved && target) save(floatingBubblePositions[target]);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={() => {
          if (drag.current) cancel();
        }}
        onBlur={() => {
          keyboardStart.current = undefined;
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (drag.current || keyboardStart.current) {
              event.preventDefault();
              event.stopPropagation();
              cancel();
              if (keyboardStart.current) save(keyboardStart.current);
              keyboardStart.current = undefined;
            }
            return;
          }
          const next = nextFloatingBubblePosition(position, event.key);
          if (!next) return;
          event.preventDefault();
          if (drag.current) return;
          keyboardStart.current ??= position;
          save(next);
        }}
        onClick={(event) => {
          if (suppressClick.current && event.detail > 0) {
            suppressClick.current = false;
            return;
          }
          suppressClick.current = false;
          onOpen();
          void runUserAction(workbench, label, () => workbench.shell.setRegionOpen("side", true, "floating"));
        }}
      >
        {icon ?? <MessageCircle size={20} strokeWidth={2} />}
      </BubbleButton>
    </Box>
  );
};
