import { chakra, type HTMLChakraProps } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { logoAtRest, logoLoaderFrameAt, logoPath } from "./logo-loader-motion";

export type LogoLoaderProps = HTMLChakraProps<"svg">;

const pose = (element: SVGPathElement, frame: ReturnType<typeof logoLoaderFrameAt>) => {
  element.setAttribute("d", logoPath(frame));
  element.setAttribute("transform", `rotate(${frame.angle} 13 13)`);
};

/** The Prompt Studio mark as a loading indicator: the ring tumbles inside the turning square. */
export const LogoLoader = (props: LogoLoaderProps) => {
  const { boxSize = "8", color = "fg.muted", ...rest } = props;
  const path = useRef<SVGPathElement>(null);
  useEffect(() => {
    const element = path.current;
    if (!element) return;
    // Reduced motion shows the still mark instead of the tumbling ring.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pose(element, logoAtRest);
      return;
    }
    // Write the path directly each frame so the animation never re-renders React.
    const start = performance.now();
    let request = 0;
    const tick = (now: number) => {
      pose(element, logoLoaderFrameAt((now - start) / 1000));
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, []);
  return (
    <chakra.svg viewBox="0 0 26 26" overflow="visible" aria-hidden="true" boxSize={boxSize} color={color} {...rest}>
      <path ref={path} d={logoPath(logoLoaderFrameAt(0))} fill="currentColor" fillRule="evenodd" />
    </chakra.svg>
  );
};
