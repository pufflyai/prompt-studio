import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import type { AssemblyView } from "../../content/tool-assembly";
import { TOOL_EXAMPLES } from "../../content/tool-examples-content";
import { DemoComposition } from "../../hooks/use-demo-composition";
import {
  BOARD_PREVIEW_HEIGHT,
  BOARD_WIDTH,
  type BoardLayout,
  boardSlots,
  SLOT_TRAY_HEIGHT,
} from "../../services/shapes/assembly-layout";
import { landingAssemblySlotRecipe } from "../../theme/recipes/landing-assembly";
import { ToolDemo } from "../examples/tool-demo";
import { ToolShape } from "./tool-shapes";

interface ToolBoardProps extends BoardLayout {
  view: AssemblyView;
}

export const ToolBoard = (props: ToolBoardProps) => {
  const { view, x, y, scale, unitScale } = props;
  const width = BOARD_WIDTH * unitScale;
  const previewHeight = BOARD_PREVIEW_HEIGHT * unitScale;
  // Larger boards gain content space instead of magnifying the controls.
  const contentScale = Math.min(1, 1 / scale);
  const example = TOOL_EXAMPLES.find((item) => item.id === view.example)!;
  const complete = example.blocks.every((block) => view.parts.includes(block.kind));
  const styles = useSlotRecipe({ recipe: landingAssemblySlotRecipe })({});
  return (
    <g
      data-tool-board=""
      data-example={view.example}
      data-complete={complete}
      transform={`translate(${x} ${y}) scale(${scale})`}
      pointerEvents="none"
    >
      <chakra.rect css={styles.card} width={width} height={previewHeight + SLOT_TRAY_HEIGHT / scale} rx="12" />
      <chakra.path css={styles.divider} d={`M0 ${38 * unitScale}H${width}M0 ${previewHeight}H${width}`} />
      {[16, 26, 36].map((cx) => (
        <chakra.circle key={cx} css={styles.chrome} cx={cx * unitScale} cy={19 * unitScale} r={3 * unitScale} />
      ))}
      <chakra.text
        css={styles.cardTitle}
        data-tool-title=""
        visibility={complete ? "visible" : "hidden"}
        x={54 * unitScale}
        y={24 * unitScale}
      >
        {example.name}
      </chakra.text>
      <g transform={`translate(${10 * unitScale} ${48 * unitScale}) scale(${contentScale})`}>
        <foreignObject
          width={(width - 20 * unitScale) / contentScale}
          height={(previewHeight - 58 * unitScale) / contentScale}
        >
          <Box css={styles.preview} inert data-tool-preview="" data-part-count={view.parts.length}>
            <DemoComposition value={{ parts: view.parts, complete }}>
              <ToolDemo key={view.example} example={view.example} />
            </DemoComposition>
          </Box>
        </foreignObject>
      </g>
      {boardSlots({ x, y, scale, unitScale }, example).map((slot) => (
        <g
          key={slot.kind}
          data-assembly-slot={slot.kind}
          visibility={example.blocks.some((block) => block.kind === slot.kind) ? "visible" : "hidden"}
          opacity={view.parts.includes(slot.kind) ? 0 : 1}
          transform={`translate(${(slot.x - x) / scale} ${(slot.y - y) / scale}) scale(${1 / scale}) translate(${-slot.width / 2} ${-slot.height / 2})`}
        >
          <ToolShape kind={slot.kind} size={slot.height} width={slot.width} outline />
        </g>
      ))}
    </g>
  );
};
