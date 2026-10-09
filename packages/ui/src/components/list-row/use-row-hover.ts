import { type PointerEvent, useEffect, useRef, useState } from "react";
import type { ListRowProps } from "./list-row.types";

export const useRowHover = (props: Pick<ListRowProps, "onPointerEnter" | "onPointerLeave">) => {
  const { onPointerEnter, onPointerLeave } = props;
  const [hovered, setHovered] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelExit = () => clearTimeout(exitTimer.current);

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  return {
    "data-hover": hovered || undefined,
    onPointerEnter: (event: PointerEvent<HTMLDivElement>) => {
      onPointerEnter?.(event);
      cancelExit();
      setHovered(true);
    },
    onPointerLeave: (event: PointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event);
      cancelExit();
      exitTimer.current = setTimeout(() => setHovered(false), 150);
    },
  };
};
