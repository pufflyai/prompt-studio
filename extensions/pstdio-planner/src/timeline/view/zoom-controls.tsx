// Offer unscaled canvas zoom controls, including a reset to the current maximum size.
import { Button, Flex, IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Minus, Plus } from "lucide-react";
import { maximumZoom, minimumZoom } from "./canvas-zoom";

export function ZoomControls(props: { zoom: number; onChange: (value: number) => void }) {
  const { zoom, onChange } = props;
  return (
    <Flex
      role="group"
      aria-label="Timeline zoom"
      position="absolute"
      left="50%"
      transform="translateX(-50%)"
      bottom="sm"
      zIndex="10"
      align="center"
      gap="2xs"
      p="2xs"
      bg="bg"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
    >
      <Tooltip content="Zoom out">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Zoom out"
          disabled={zoom <= minimumZoom}
          onClick={() => onChange(zoom - 0.1)}
        >
          <Minus size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip content="Reset to 100%">
        <Button
          size="xs"
          variant="ghost"
          aria-label={`Reset zoom to 100%, current zoom ${Math.round(zoom * 100)}%`}
          onClick={() => onChange(1)}
        >
          {Math.round(zoom * 100)}%
        </Button>
      </Tooltip>
      <Tooltip content="Zoom in">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Zoom in"
          disabled={zoom >= maximumZoom}
          onClick={() => onChange(zoom + 0.1)}
        >
          <Plus size={14} />
        </IconButton>
      </Tooltip>
    </Flex>
  );
}
