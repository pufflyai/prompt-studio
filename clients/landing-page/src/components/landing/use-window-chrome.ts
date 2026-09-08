import { useEffect, useRef, useState } from "react";

const DESKTOP_INSET = 96;

/**
 * The easter egg. Any Mac window control unmaximises the page onto a desktop, where the
 * title bar becomes a drag handle. Every control leads somewhere recoverable on purpose:
 * a landing page that can be closed into a blank desktop is a dead end, and someone will
 * click red first. Not persisted, so a reload comes back maximised.
 */
export const useWindowChrome = () => {
  const [windowed, setWindowed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ id: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const toggleWindowed = () => {
    setWindowed((value) => {
      if (value) setOffset({ x: 0, y: 0 });
      return !value;
    });
  };

  const onTitleBarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!windowed) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  useEffect(() => {
    if (!windowed) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== event.pointerId) return;

      // Clamped so the title bar always stays reachable: the window can go partly
      // off-screen but can never be lost.
      const limitX = Math.max(0, window.innerWidth / 2);
      const limitY = Math.max(0, window.innerHeight / 2 - DESKTOP_INSET);

      setOffset({
        x: Math.max(-limitX, Math.min(limitX, drag.originX + event.clientX - drag.startX)),
        y: Math.max(-DESKTOP_INSET, Math.min(limitY, drag.originY + event.clientY - drag.startY)),
      });
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [windowed]);

  return { windowed, offset, toggleWindowed, onTitleBarPointerDown };
};
