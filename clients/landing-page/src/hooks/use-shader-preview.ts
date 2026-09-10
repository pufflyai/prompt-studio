import { useEffect, useRef, useState } from "react";
import { createShaderIconTexture } from "../services/shader-icon-texture";
import { createShaderPreview } from "../services/shader-preview";

export const useShaderPreview = (source: string, scale: number, speed: number, codepoint?: string) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<ReturnType<typeof createShaderPreview> | null>(null);
  const timeRef = useRef(0);
  const scaleRef = useRef(scale);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let preview: ReturnType<typeof createShaderPreview>;
    try {
      preview = createShaderPreview(canvas);
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    previewRef.current = preview;
    const resize = new ResizeObserver(() => {
      preview.resize();
      preview.render(timeRef.current, scaleRef.current);
    });
    resize.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    visibility.observe(canvas);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const respectMotion = () => {
      if (motion.matches) setPlaying(false);
    };
    respectMotion();
    motion.addEventListener("change", respectMotion);
    return () => {
      resize.disconnect();
      visibility.disconnect();
      motion.removeEventListener("change", respectMotion);
      preview.dispose();
      previewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    setError(preview.setSource(source));
    preview.render(timeRef.current, scaleRef.current);
  }, [source]);

  useEffect(() => {
    if (!codepoint) return;
    let active = true;
    createShaderIconTexture(codepoint)
      .then((texture) => {
        if (!active) return;
        previewRef.current?.setIcon(texture);
        previewRef.current?.render(timeRef.current, scaleRef.current);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [codepoint]);

  useEffect(() => {
    scaleRef.current = scale;
    previewRef.current?.render(timeRef.current, scale);
  }, [scale]);

  useEffect(() => {
    if (!playing || !inView || speed === 0) return;
    let lastTime = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const elapsed = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      if (!document.hidden) {
        timeRef.current += elapsed * speed;
        previewRef.current?.render(timeRef.current, scaleRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, inView, speed]);

  return { canvasRef, error, playing, toggle: () => setPlaying((value) => !value) };
};
