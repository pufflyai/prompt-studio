import { Box } from "@chakra-ui/react";
import { useShapeField } from "../../hooks/use-shape-field";
import { pieceTransform } from "../../services/shapes/shape-physics";
import { ToolShape } from "./tool-shapes";

interface ShapeFieldProps {
  worldOffset?: { x: number; y: number };
}

export const ShapeField = (props: ShapeFieldProps) => {
  const { worldOffset } = props;
  const { hostRef, reducedMotion, staticPieces, pieces, onPointerDown, onPointerMove, onPointerUp } =
    useShapeField(worldOffset);
  if (reducedMotion) {
    return (
      <Box ref={hostRef} position="absolute" inset="0" pointerEvents="none">
        {staticPieces.map((piece) => (
          <Box
            key={piece.id}
            data-tool-shape={piece.kind}
            position="absolute"
            left={`${piece.x}px`}
            top={`${piece.y}px`}
            transform={`rotate(${piece.angle}rad)`}
          >
            <ToolShape kind={piece.kind} size={piece.height} width={piece.width} />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box ref={hostRef} position="absolute" inset="0" pointerEvents="none" userSelect="none" touchAction="none">
      {pieces.map((piece) => (
        <Box
          key={piece.id}
          data-tool-shape={piece.kind}
          position="absolute"
          left="0"
          top="0"
          width={`${piece.width}px`}
          height={`${piece.height}px`}
          cursor="grab"
          pointerEvents="auto"
          transformOrigin="0 0"
          _active={{ cursor: "grabbing" }}
          // Inline transform on purpose: this changes every frame, and a Chakra style
          // prop would mint a new atomic CSS class each time.
          style={{
            transform: pieceTransform(piece),
          }}
          onPointerDown={onPointerDown(piece)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <ToolShape kind={piece.kind} size={piece.height} width={piece.width} />
        </Box>
      ))}
    </Box>
  );
};
