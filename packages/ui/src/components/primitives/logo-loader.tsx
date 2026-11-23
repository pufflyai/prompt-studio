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
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let request: number | undefined;
    const stop = () => {
      if (request === undefined) return;
      cancelAnimationFrame(request);
      request = undefined;
    };
    const syncMotion = () => {
      if (preference.matches) {
        stop();
        pose(element, logoAtRest);
        return;
      }
      if (request !== undefined) return;

      // Write the path directly each frame so the animation never re-renders React.
      const start = performance.now();
      const tick = (now: number) => {
        pose(element, logoLoaderFrameAt((now - start) / 1000));
        request = requestAnimationFrame(tick);
      };
      request = requestAnimationFrame(tick);
    };
    preference.addEventListener("change", syncMotion);
    syncMotion();
    return () => {
      preference.removeEventListener("change", syncMotion);
      stop();
    };
  }, []);
  return (
    <chakra.svg viewBox="0 0 26 26" overflow="visible" aria-hidden="true" boxSize={boxSize} color={color} {...rest}>
      <path ref={path} d={logoPath(logoAtRest)} fill="currentColor" fillRule="evenodd" />
    </chakra.svg>
  );
};
