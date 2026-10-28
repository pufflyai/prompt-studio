import { createContext, type RefObject, useContext, useEffect, useRef, useState } from "react";
import type { createFrameStartupQueue } from "./startup-queue";

export const FrameStartupContext = createContext<ReturnType<typeof createFrameStartupQueue> | undefined>(undefined);
const priority = (selected: boolean, visible: boolean) => {
  if (selected) return 0;
  return visible ? 1 : 2;
};
export const useFrameStartup = (element: RefObject<HTMLElement | null>, selected: boolean, revision: number) => {
  const queue = useContext(FrameStartupContext)!;
  const job = useRef<ReturnType<typeof queue.enqueue>>(undefined);
  const visible = useRef(false);
  const selectedRef = useRef(selected);
  const [startedRevision, setStartedRevision] = useState<number>();
  const queuedAt = useRef(performance.now());
  const startedAt = useRef(queuedAt.current);
  useEffect(() => {
    queuedAt.current = performance.now();
    const request = queue.enqueue(
      () => {
        startedAt.current = performance.now();
        setStartedRevision(revision);
      },
      selectedRef.current ? 0 : 2,
    );
    job.current = request;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        request.prioritize(priority(selectedRef.current, visible.current));
      },
      { root: element.current?.closest("[data-canvas-viewport]"), rootMargin: "160px" },
    );
    if (element.current) observer.observe(element.current);
    return () => {
      observer.disconnect();
      request.cancel();
    };
  }, [queue, element, revision]);
  useEffect(() => {
    selectedRef.current = selected;
    job.current?.prioritize(priority(selected, visible.current));
  }, [selected]);
  return {
    started: startedRevision === revision,
    queuedAt,
    startedAt,
    job,
  };
};
