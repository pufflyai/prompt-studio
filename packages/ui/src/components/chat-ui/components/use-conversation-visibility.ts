import { useLayoutEffect } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

// Temporary library limitation: documentation/adrs/0075-temporary-hidden-conversation-scroll-restoration.md.
export const useConversationVisibility = () => {
  const { scrollRef, stopScroll, scrollToBottom } = useStickToBottomContext();
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    let hidden = false;
    let position = { top: viewport.scrollTop, atTail: true };
    let frame = 0;
    const rememberPosition = () => {
      if (hidden || viewport.getClientRects().length === 0) return;
      position = {
        top: viewport.scrollTop,
        atTail: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 3,
      };
    };
    const observer = new ResizeObserver(() => {
      const isHidden = viewport.getClientRects().length === 0;
      if (isHidden) {
        hidden = true;
        stopScroll();
      } else if (hidden) {
        hidden = false;
        const saved = position;
        stopScroll();
        viewport.scrollTop = saved.top;
        frame = requestAnimationFrame(() => {
          if (saved.atTail) void scrollToBottom("instant");
          else viewport.scrollTop = saved.top;
        });
      }
    });
    viewport.addEventListener("scroll", rememberPosition);
    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.removeEventListener("scroll", rememberPosition);
    };
  }, [scrollRef, stopScroll, scrollToBottom]);
};
