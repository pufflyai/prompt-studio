import { Stack } from "@chakra-ui/react";
import type { CanvasControls, CanvasMeta } from "@pstdio/canvas";
import { useLayoutEffect, useRef, useState } from "react";
import { ShaderSurface } from "./shader-surface";
import { defaultValues, findShader, normalizeValues, type ShaderValues } from "./shaders/definitions";
import { TicketCard, WorkspaceContainer } from "./surfaces";
import { createClock } from "./use-clock";

const ShaderCanvas = (props: { shader: string; values: ShaderValues; time: number; theme: "light" | "dark" }) => {
  const { shader, values, time, theme } = props;
  const [clock] = useState(() => createClock({ external: true }));
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const update = () => {
      for (const animation of root.current?.getAnimations({ subtree: true }) ?? []) {
        animation.pause();
        // A zero-speed layer retains its initial phase even while other layers seek.
        animation.currentTime =
          animation instanceof CSSAnimation && animation.animationName.endsWith("-stationary")
            ? 0
            : clock.time() * 1000;
      }
    };
    update();
    return clock.subscribe(update);
  }, [clock]);
  useLayoutEffect(() => {
    clock.seek(time);
  }, [clock, time]);
  const surface = <ShaderSurface shader={shader} values={values} theme={theme} clock={clock} />;
  return (
    <Stack ref={root} gap="md" p="lg" bg="bg.subtle" color="fg">
      <WorkspaceContainer surface={surface} elapsed={`${time.toFixed(1)} s`} />
      <TicketCard id="PS-461" title="Review the design" surface={surface} active />
      <TicketCard id="PS-458" title="Compare another frame" />
    </Stack>
  );
};

export const shaderCanvas = (id: string, config: { name: string; values: ShaderValues }) => {
  const shader = findShader(id);
  const controls: CanvasControls = Object.fromEntries(
    shader.groups.flatMap((group) =>
      group.fields.map((field) => [
        field.id,
        {
          type: "number",
          label: `${group.title}: ${field.name}`,
          description: field.description,
          min: field.min,
          max: field.max,
          step: field.step,
        },
      ]),
    ),
  );
  return {
    args: { ...defaultValues(shader), ...config.values, time: 0 },
    controls,
    description: shader.description,
    motion: { duration: 30, fps: 30 },
    render: (args, { theme }) => (
      <ShaderCanvas shader={id} values={normalizeValues(shader, args)} time={Number(args.time)} theme={theme.mode} />
    ),
  } satisfies CanvasMeta;
};
