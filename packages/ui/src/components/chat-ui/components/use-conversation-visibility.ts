import { useLayoutEffect } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

// Temporary library limitation: documentation/adrs/0075-temporary-hidden-conversation-scroll-restoration.md.
export const useConversationVisibility = () => {
  const { scrollRef, stopScroll, scrollToBottom, state } = useStickToBottomContext();
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    let hidden = false;
    let position = { top: viewport.scrollTop, following: state.isAtBottom };
    let frame = 0;
    const rememberPosition = () => {
      if (hidden || viewport.getClientRects().length === 0) return;
      position = { ...position, top: viewport.scrollTop };
    };
    const observer = new ResizeObserver(() => {
      const isHidden = viewport.getClientRects().length === 0;
      if (isHidden) {
        if (hidden) return;
        position = { ...position, following: state.isAtBottom };
        hidden = true;
        stopScroll();
      } else if (hidden) {
        hidden = false;
        const saved = position;
        stopScroll();
        viewport.scrollTop = saved.top;
        frame = requestAnimationFrame(() => {
          if (saved.following) void scrollToBottom("instant");
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
  }, [scrollRef, stopScroll, scrollToBottom, state]);
};
