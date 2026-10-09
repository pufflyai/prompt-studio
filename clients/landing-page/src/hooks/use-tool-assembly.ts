import { useLayoutEffect, useRef, useState } from "react";
import type { AssemblyView } from "../content/tool-assembly";
import { assemblyLayout, DEFAULT_FIELD_SIZE } from "../services/shapes/assembly-layout";
import { createToolAssembly } from "../services/shapes/tool-assembly";

export const useToolAssembly = () => {
  const sceneRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<AssemblyView>({ example: "icons", parts: [] });
  const [board, setBoard] = useState(() => assemblyLayout(DEFAULT_FIELD_SIZE).board);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const scene = sceneRef.current!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const assembly = createToolAssembly(scene, setView, setBoard);
    setReady(true);
    const bounds = scene.getBoundingClientRect();
    let visible =
      bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth;
    const sync = () => assembly.sync(visible && document.visibilityState === "visible", motion.matches);
    sync();
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const resize = new ResizeObserver(() => assembly.resize());
    resize.observe(scene);
    const copy = scene.closest("[data-assembly-area]")?.querySelector("[data-download-panel]");
    if (copy) resize.observe(copy);
    observer.observe(scene);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    return () => {
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      assembly.destroy();
    };
  }, []);
  return { sceneRef, view, board, ready };
};
