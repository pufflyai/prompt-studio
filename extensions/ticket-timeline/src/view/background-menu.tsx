// Show the background context menu at the click: create a ticket or an agent gate with creation defaults.
import { Box, Button } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import type { CreateContext } from "./ticket-form";

export interface BackgroundContext extends CreateContext {
  x: number;
  y: number;
}

// Keep the menu inside the view when the click is near an edge.
const menuWidth = 180;

const menuHeight = 108;

// The host menu ignores an anchor point without a trigger and opens at the frame's corner, so this
// small menu positions itself and closes on Escape or a click elsewhere.
export function BackgroundMenu({
  context,
  onCreate,
  onClose,
}: {
  context: BackgroundContext;
  onCreate: (kind: "ticket" | "gate" | "artifact", context: CreateContext) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [onClose]);

  return (
    <Box
      ref={ref}
      role="menu"
      position="fixed"
      zIndex="popover"
      left={`${Math.max(0, Math.min(context.x, window.innerWidth - menuWidth))}px`}
      top={`${Math.max(0, Math.min(context.y, window.innerHeight - menuHeight))}px`}
      w={`${menuWidth}px`}
      p="2xs"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      boxShadow="md"
    >
      <Button
        role="menuitem"
        size="sm"
        variant="ghost"
        w="full"
        justifyContent="start"
        onClick={() => onCreate("ticket", context)}
      >
        Create ticket
      </Button>
      <Button
        role="menuitem"
        size="sm"
        variant="ghost"
        w="full"
        justifyContent="start"
        onClick={() => onCreate("gate", context)}
      >
        Add agent gate
      </Button>
      <Button
        role="menuitem"
        size="sm"
        variant="ghost"
        w="full"
        justifyContent="start"
        onClick={() => onCreate("artifact", context)}
      >
        Add artifact
      </Button>
    </Box>
  );
}
