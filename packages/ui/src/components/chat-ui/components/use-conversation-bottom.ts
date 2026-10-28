import { useSyncExternalStore } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

export function useConversationBottom() {
  const { scrollRef, contentRef } = useStickToBottomContext();

  return useSyncExternalStore(
    (notify) => {
      const viewport = scrollRef.current;
      if (!viewport) return () => {};
      viewport.addEventListener("scroll", notify);
      const observer = new ResizeObserver(notify);
      observer.observe(viewport);
      if (contentRef.current) observer.observe(contentRef.current);
      return () => {
        viewport.removeEventListener("scroll", notify);
        observer.disconnect();
      };
    },
    () => {
      const viewport = scrollRef.current;
      // The scroll-lock library includes a near-bottom tolerance. Placement needs the physical end.
      return !viewport || viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 1;
    },
    () => true,
  );
}
