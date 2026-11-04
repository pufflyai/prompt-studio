import { useEffect, useRef, useState } from "react";

export function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [labels, setLabels] = useState<Record<string, number>>({});
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const measured = Object.fromEntries(
        [...element.querySelectorAll<SVGTextElement>(".ts-chart__marks text")].map((text) => [
          text.textContent ?? "",
          text.getBBox().width,
        ]),
      );
      setLabels((previous) =>
        Object.keys(previous).length === Object.keys(measured).length &&
        Object.entries(measured).every(([label, size]) => previous[label] === size)
          ? previous
          : measured,
      );
    };
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
      measure();
    });
    observer.observe(element);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  });
  return { ref, width, measureLabel: (label: string) => labels[label] ?? label.length * 12 };
}
