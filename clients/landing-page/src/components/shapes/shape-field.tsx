import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import { useId } from "react";
import { ASSEMBLY_AGENTS, LOOSE_PIECES } from "../../content/tool-assembly";
import { useToolAssembly } from "../../hooks/use-tool-assembly";
import { cursorStart, DEFAULT_FIELD_SIZE } from "../../services/shapes/assembly-layout";
import { landingAssemblySlotRecipe } from "../../theme/recipes/landing-assembly";
import { AssemblyCursor } from "./assembly-cursor";
import { ToolBoard } from "./tool-board";
import { ToolShape } from "./tool-shapes";

export const ShapeField = () => {
  const { sceneRef, view, board, ready } = useToolAssembly();
  const styles = useSlotRecipe({ recipe: landingAssemblySlotRecipe })({});
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Box css={styles.root}>
      <chakra.svg
        ref={sceneRef}
        css={styles.scene}
        data-assembly-ready={ready}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <title id={titleId}>Build tools with draggable shapes</title>
        <desc id={descriptionId}>
          Drag or toss shapes anywhere in the main area. Loose shapes fall and collide. Drop a matching shape into a
          board to build part of a tool. Cursors take turns building different tools and yield the shape you grab. Arrow
          keys move a focused shape; Enter docks it in a nearby slot.
        </desc>
        <ToolBoard view={view} {...board} />
        <chakra.svg css={styles.pile} asChild>
          <svg x="50%" y="100%" width="1" height="1" data-assembly-pile="">
            <title>Draggable shapes</title>
            {LOOSE_PIECES.map((piece) => (
              <chakra.g
                key={piece.id}
                css={styles.piece}
                asChild
                role="button"
                tabIndex={0}
                aria-label={`Drag ${piece.kind} building block`}
                data-tool-shape={piece.kind}
                data-assembly-piece={piece.id}
              >
                <g transform={`translate(${piece.source.x} ${piece.source.y}) rotate(${piece.source.angle})`}>
                  <rect
                    x={-Math.max(piece.width, 32) / 2}
                    y={-Math.max(piece.height, 32) / 2}
                    width={Math.max(piece.width, 32)}
                    height={Math.max(piece.height, 32)}
                    fill="transparent"
                  />
                  <g transform={`translate(${-piece.width / 2} ${-piece.height / 2})`}>
                    <ToolShape kind={piece.kind} size={piece.height} width={piece.width} />
                  </g>
                </g>
              </chakra.g>
            ))}
          </svg>
        </chakra.svg>
        {ASSEMBLY_AGENTS.map((name, index) => (
          <AssemblyCursor key={name} name={name} index={index} point={cursorStart(DEFAULT_FIELD_SIZE.width, index)} />
        ))}
      </chakra.svg>
    </Box>
  );
};
