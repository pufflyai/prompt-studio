import { useEffect, useRef } from "react";

/** Overscan mounts unread rows too. Only viewport intersections witness displayed content. */
export const useChatMessageVisibility = (
  viewport: { current: HTMLElement | null },
  rows: string,
  changed?: (ids: string[]) => void,
) => {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = viewport.current;
    const content = list.current;
    if (!root || !content || !changed || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const groups: string[][] = JSON.parse(rows);
    const mounted = new Map(groups.map((ids) => [ids[0], ids]));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.chatMessageId;
          if (!id || !mounted.has(id)) continue;
          if (entry.isIntersecting && entry.intersectionRect.height > 0) visible.add(id);
          else visible.delete(id);
        }
        changed([...visible].flatMap((id) => mounted.get(id) ?? []));
      },
      { root },
    );
    for (const row of content.querySelectorAll("[data-chat-message-id]")) observer.observe(row);
    return () => {
      observer.disconnect();
      changed([]);
    };
  }, [viewport, rows, changed]);
  return list;
};
