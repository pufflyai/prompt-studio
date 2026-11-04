import { Box } from "@chakra-ui/react";
import type { CanvasControls, CanvasMeta } from "@pstdio/canvas";
import { type ComponentType, useEffect, useRef, useState } from "react";
import type { SceneProps } from "./kit/model";
import type { StudyMetadata } from "./study-metadata";

interface StudyCanvasProps extends Record<string, unknown> {
  time: number;
  preset: "instant" | "subtle" | "slower";
  reducedMotion: boolean;
}
const StudyCanvas = (props: { Scene: ComponentType<SceneProps>; study: StudyMetadata; args: StudyCanvasProps }) => {
  const { Scene, study, args } = props;
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const canvas = study.canvas === "pane" ? { width, height: 480 } : study.canvas;
  const size = canvas === "workbench" ? { width: 1440, height: 900 } : canvas;
  const scale = width / size.width;
  const values = Object.fromEntries(
    study.params.map((parameter) => [parameter.id, String(args[parameter.id] ?? parameter.default.right)]),
  );
  return (
    <Box
      ref={root}
      w="full"
      h={`${size.height * scale}px`}
      overflow="hidden"
      bg="bg.subtle"
      color="fg"
      css={{
        "& *, & *::before, & *::after": {
          animation: "none !important",
          transition: "none !important",
          caretColor: "transparent",
        },
      }}
    >
      <Box w={`${size.width}px`} h={`${size.height}px`} transform={`scale(${scale})`} transformOrigin="top left">
        <Scene time={Number(args.time)} variant={{ preset: args.preset, values }} reducedMotion={args.reducedMotion} />
      </Box>
    </Box>
  );
};

export const motionCanvas = (raw: unknown, Scene: ComponentType<SceneProps>) => {
  const study = { ...(raw as StudyMetadata), params: (raw as StudyMetadata).params ?? [] };
  const controls: CanvasControls = {
    preset: {
      label: "Preset",
      type: "select",
      options: ["instant", "subtle", "slower"].map((value) => ({
        value,
        label: value[0].toUpperCase() + value.slice(1),
      })),
    },
    reducedMotion: { label: "Reduced motion", type: "boolean" },
    ...Object.fromEntries(
      study.params.map((parameter) => [
        parameter.id,
        {
          label: parameter.name,
          description: parameter.description,
          type: "select",
          options: parameter.options.map((option) => ({ value: option.id, label: option.name })),
        },
      ]),
    ),
  };
  return {
    description: study.description,
    args: {
      time: 0,
      preset: "subtle",
      reducedMotion: false,
      ...Object.fromEntries(study.params.map((parameter) => [parameter.id, parameter.default.right])),
    },
    controls,
    motion: { duration: study.duration, fps: 60, markers: study.markers },
    render: (args) => <StudyCanvas Scene={Scene} study={study} args={args} />,
  } satisfies CanvasMeta<StudyCanvasProps>;
};
