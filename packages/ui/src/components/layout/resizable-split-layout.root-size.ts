import { type RefObject, useEffect, useState } from "react";

export type PanelDimension = "width" | "height";

// Tracks the root element's size along the split axis so the panel bounds
// follow window and container resizes.
export const useResizableSplitRootSize = (
  rootRef: RefObject<HTMLDivElement | null>,
  separatorRef: RefObject<HTMLDivElement | null>,
  dimension: PanelDimension,
) => {
  const [size, setSize] = useState({ rootSize: 0, separatorSize: 0 });

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const updateRootSize = () => {
      setSize({
        rootSize: element.getBoundingClientRect()[dimension],
        separatorSize: separatorRef.current?.getBoundingClientRect()[dimension] ?? 0,
      });
    };

    updateRootSize();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateRootSize);
    observer.observe(element);
    if (separatorRef.current) observer.observe(separatorRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rootRef, separatorRef, dimension]);

  return size;
};
