import type { SessionCompletionStatus } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import {
  WORKFLOW_FRAME_MS,
  WORKFLOW_FRAMES,
  WORKFLOW_RESTART_FRAMES,
  WORKFLOW_STEPS,
} from "../content/workflow-demo-content";

export const useWorkflowDemo = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const respectMotion = () => {
      if (motion.matches) setPlaying(false);
    };
    respectMotion();
    motion.addEventListener("change", respectMotion);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(hostRef.current!);
    return () => {
      motion.removeEventListener("change", respectMotion);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        setFrameIndex((index) => (index + 1) % (WORKFLOW_FRAMES.length + WORKFLOW_RESTART_FRAMES));
      }
    }, WORKFLOW_FRAME_MS);
    return () => window.clearInterval(interval);
  }, [playing, inView]);

  const finished = frameIndex >= WORKFLOW_FRAMES.length;
  const frame = WORKFLOW_FRAMES[Math.min(frameIndex, WORKFLOW_FRAMES.length - 1)];
  const completed = finished ? WORKFLOW_STEPS.length : frame.stepIndex;
  const steps = WORKFLOW_STEPS.map((step, index) => {
    let status: SessionCompletionStatus = "queued";
    if (index < completed) status = "completed";
    if (!finished && index === frame.stepIndex) status = playing ? "in_progress" : "disconnected";
    return { ...step, status };
  });

  return {
    hostRef,
    playing,
    finished,
    frame,
    steps,
    completed,
    toggle: () => setPlaying((value) => !value),
  };
};
