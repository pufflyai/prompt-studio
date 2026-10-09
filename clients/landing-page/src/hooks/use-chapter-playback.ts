import { type RefObject, useEffect, useRef, useState } from "react";

export const CHAPTER_INTERVAL_MS = 8000;

export const useChapterPlayback = (rootRef: RefObject<HTMLDivElement | null>, value: string, advance: () => void) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const playing = !hovered && !focused && !reduced;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(motion.matches);
    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, []);

  // Changing a chapter or finishing an interaction always gives a full reading interval.
  useEffect(() => {
    if (!playing || !value) return;
    let visible = false;
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(timer);
      if (visible && document.visibilityState === "visible")
        timer = setTimeout(() => advanceRef.current(), CHAPTER_INTERVAL_MS);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(rootRef.current!);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [playing, value, rootRef]);

  return { playing, setHovered, setFocused };
};
