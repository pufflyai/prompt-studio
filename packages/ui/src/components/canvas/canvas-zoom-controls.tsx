import { Button, Flex, IconButton, useRecipe } from "@chakra-ui/react";
import { Minus, Plus } from "lucide-react";
import { canvasZoomControlsRecipe } from "../../theme/recipes/canvas";
import { Tooltip } from "../primitives/tooltip";

interface CanvasZoomControlsProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  resetZoom: number;
  onChange: (zoom: number) => void;
  onStep: (delta: number) => void;
}
export const CanvasZoomControls = (props: CanvasZoomControlsProps) => {
  const { zoom, minZoom, maxZoom, resetZoom, onChange, onStep } = props;
  const styles = useRecipe({ recipe: canvasZoomControlsRecipe })();
  const resetPercent = Math.round(resetZoom * 100);
  return (
    <Flex role="group" aria-label="Canvas zoom" css={styles} data-canvas-control>
      <Tooltip content="Zoom out">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Zoom out"
          disabled={zoom <= minZoom}
          onClick={() => onStep(-0.1)}
        >
          <Minus />
        </IconButton>
      </Tooltip>
      <Tooltip content={`Reset to ${resetPercent}%`}>
        <Button
          size="xs"
          variant="ghost"
          aria-label={`Reset zoom to ${resetPercent}%, current zoom ${Math.round(zoom * 100)}%`}
          onClick={() => onChange(resetZoom)}
        >
          {Math.round(zoom * 100)}%
        </Button>
      </Tooltip>
      <Tooltip content="Zoom in">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Zoom in"
          disabled={zoom >= maxZoom}
          onClick={() => onStep(0.1)}
        >
          <Plus />
        </IconButton>
      </Tooltip>
    </Flex>
  );
};
