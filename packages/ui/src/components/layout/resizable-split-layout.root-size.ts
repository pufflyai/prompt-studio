import { type RefObject, useEffect, useState } from "react";

export type PanelDimension = "width" | "height";

// Tracks the root element's size along the split axis so the panel bounds
// follow window and container resizes.
export const useResizableSplitRootSize = (rootRef: RefObject<HTMLDivElement | null>, dimension: PanelDimension) => {
  const [rootSize, setRootSize] = useState(0);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const updateRootSize = () => {
      setRootSize(element.getBoundingClientRect()[dimension]);
    };

    updateRootSize();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateRootSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootRef, dimension]);

  return rootSize;
};
