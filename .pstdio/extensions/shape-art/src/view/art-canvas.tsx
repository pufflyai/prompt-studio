import { Box, Spinner } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { Recipe } from "../art/recipe";
import { renderPiece } from "../art/render";

interface ArtCanvasProps {
  recipe: Recipe;
  label: string;
}

// Preview at a capped resolution so edits stay responsive; export repaints at full size.
const PREVIEW_PIXELS = 1400 * 800;

export const ArtCanvas = (props: ArtCanvasProps) => {
  const { recipe, label } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painting, setPainting] = useState(false);

  useEffect(() => {
    setPainting(true);
    // Let the spinner paint before the synchronous render blocks the thread.
    const timer = setTimeout(() => {
      const scale = Math.min(1, Math.sqrt(PREVIEW_PIXELS / (recipe.width * recipe.height)));
      const { width, height, pixels } = renderPiece(recipe, scale);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
      }
      setPainting(false);
    }, 30);
    return () => clearTimeout(timer);
  }, [recipe]);

  return (
    <Box position="relative" flex="1" minH="0" minW="0">
      <Box position="absolute" inset="0" display="flex" alignItems="center" justifyContent="center" p="lg">
        <Box asChild maxW="full" maxH="full" borderRadius="md" boxShadow="md">
          <canvas ref={canvasRef} aria-label={label} />
        </Box>
      </Box>
      {painting ? <Spinner position="absolute" top="md" right="md" size="sm" color="fg.muted" /> : null}
    </Box>
  );
};
