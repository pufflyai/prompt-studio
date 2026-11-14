import type { ResourceActivityEntry } from "@pstdio/sdk/extensions";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export const useActivityHistory = (
  items: ResourceActivityEntry[],
  hasEarlier: boolean,
  visible: boolean,
  load: () => Promise<boolean | undefined>,
) => {
  const boundary = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [failed, setFailed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const anchor = useRef<{
    element: HTMLElement;
    viewport: HTMLElement;
    top: number;
    scrollTop: number;
    items: ResourceActivityEntry[];
    finished: boolean;
  }>(null);
  const loadEarlier = async () => {
    if (!hasEarlier || !visible || busy.current) return;
    const element = boundary.current?.parentElement?.querySelector<HTMLElement>("[data-activity-entry]");
    const viewport = boundary.current?.closest<HTMLElement>('[data-scope="scroll-area"][data-part="viewport"]');
    if (element && viewport)
      anchor.current = {
        element,
        viewport,
        top: element.getBoundingClientRect().top,
        scrollTop: viewport.scrollTop,
        items,
        finished: false,
      };
    busy.current = true;
    setFailed(false);
    try {
      setFailed(!(await load()));
    } finally {
      busy.current = false;
      if (anchor.current) anchor.current.finished = true;
      setCompleted((value) => value + 1);
    }
  };
  const loadEvent = useEffectEvent(loadEarlier);
  useLayoutEffect(() => {
    const saved = anchor.current;
    if (!saved?.element.isConnected) return;
    if (saved.items !== items) {
      // Account for scrolling while queued/reading, including intervening live reads.
      saved.viewport.scrollTop +=
        saved.element.getBoundingClientRect().top - saved.top + saved.viewport.scrollTop - saved.scrollTop;
      saved.top = saved.element.getBoundingClientRect().top;
      saved.scrollTop = saved.viewport.scrollTop;
      saved.items = items;
    }
    if (completed && saved.finished) anchor.current = null;
  }, [items, completed]);
  useEffect(() => {
    if (!hasEarlier || !visible || !boundary.current) return;
    let armed = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) armed = true;
        else if (armed) {
          armed = false;
          void loadEvent();
        }
      },
      { root: boundary.current.closest('[data-scope="scroll-area"][data-part="viewport"]') },
    );
    observer.observe(boundary.current);
    return () => observer.disconnect();
  }, [hasEarlier, visible]);
  return { boundary, failed: hasEarlier && failed, retry: loadEarlier, clearError: () => setFailed(false) };
};
