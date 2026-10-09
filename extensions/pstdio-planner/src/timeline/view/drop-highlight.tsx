// Mark both destination axes lightly and outline the cell where the ticket will land.
import { Box } from "@chakra-ui/react";
import type { dropRegion } from "./drop-region";
import { gutterWidth } from "./graph-geometry";

export function DropHighlight(props: { region: ReturnType<typeof dropRegion>; width: number; height: number }) {
  const { region, width, height } = props;
  if (!region) {
    return null;
  }

  const { band, track, trackId } = region;
  return (
    <Box position="absolute" inset="0" pointerEvents="none" zIndex="2" aria-hidden="true">
      <Box
        data-drop-milestone={band.deadlineId ?? "unassigned"}
        position="absolute"
        left={`${gutterWidth}px`}
        top={`${band.top}px`}
        w={`${width - gutterWidth}px`}
        h={`${band.height}px`}
        bg="border.accent/3"
        borderBlockWidth="1px"
        borderColor="border.accent/20"
      />
      {track ? (
        <>
          <Box
            data-drop-track={trackId}
            position="absolute"
            left={`${track.x}px`}
            top="0"
            w={`${track.width}px`}
            h={`${height}px`}
            bg="border.accent/3"
            borderInlineWidth="1px"
            borderColor="border.accent/20"
          />
          <Box
            data-drop-cell
            position="absolute"
            left={`${track.x}px`}
            top={`${band.top}px`}
            w={`${track.width}px`}
            h={`${band.height}px`}
            bg="border.accent/4"
            borderWidth="1px"
            borderColor="border.accent/60"
          />
        </>
      ) : null}
    </Box>
  );
}
