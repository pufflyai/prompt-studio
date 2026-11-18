import { instrument } from "bippy";
import { createRenderOutlinePainter } from "react-scan";

/** The painter draws React Scan's component labels and outlines. See ADR 0156. */
export const startRenderHighlights = () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("React Scan is unavailable without a canvas");
  canvas.dataset.reactScan = "true";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "2147483646",
  });
  const painter = createRenderOutlinePainter(canvas, context);
  let frame: number | undefined;
  const draw = () => {
    frame = painter.draw() ? requestAnimationFrame(draw) : undefined;
  };
  const unsubscribe = instrument({
    name: "react-scan",
    onCommitFiberRoot(_renderer, root) {
      if (painter.collect(root) && frame === undefined) frame = requestAnimationFrame(draw);
    },
  });
  document.documentElement.appendChild(canvas);
  return () => {
    unsubscribe();
    if (frame !== undefined) cancelAnimationFrame(frame);
    canvas.remove();
  };
};
