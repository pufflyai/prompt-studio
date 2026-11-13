import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

// Canvas-only evidence. Observe the follower's live state without owning or changing its intent.
export const useResizeFollowEvidence = () => {
  const { scrollRef, contentRef, state } = useStickToBottomContext();
  const events = useRef<object[]>([]);
  const record = (event: string) => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    events.current.push({
      event,
      at: performance.now(),
      top: viewport.scrollTop,
      height: viewport.scrollHeight,
      viewportHeight: viewport.clientHeight,
      visible: viewport.getClientRects().length > 0,
      following: state.isAtBottom,
      escaped: state.escapedFromLock,
      nearBottom: state.isNearBottom,
      resizeDifference: state.resizeDifference,
    });
    if (events.current.length > 512) events.current.shift();
  };
  useEffect(() => {
    const viewport = scrollRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const evidence = events.current;
    Reflect.set(viewport, "__chatResizeEvidence", evidence);
    let frame = 0;
    const observe = (event: string) => {
      record(event);
      // Sample after the same event's follower/virtualizer callbacks, without delaying actions.
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          record("animation-frame");
        });
      }
    };
    const scroll = () => observe("scroll");
    const action = (event: Event) => {
      const target = event.target;
      if (target instanceof Element) {
        const button = target.closest("button");
        if (button) observe(`action:${button.textContent}`);
      }
    };
    const fixture = viewport.closest("[data-chat-resize-fixture]");
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        observe(
          `resize:${entry.target === viewport ? "viewport" : "content"}:${entry.contentRect.width}x${entry.contentRect.height}`,
        );
      }
    });
    observer.observe(viewport);
    observer.observe(content);
    viewport.addEventListener("scroll", scroll, { passive: true });
    fixture?.addEventListener("click", action, { capture: true });
    record("mounted");
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.removeEventListener("scroll", scroll);
      fixture?.removeEventListener("click", action, { capture: true });
      if (Reflect.get(viewport, "__chatResizeEvidence") === evidence) {
        Reflect.deleteProperty(viewport, "__chatResizeEvidence");
      }
    };
  }, [scrollRef, contentRef, state, record]);
  return record;
};
