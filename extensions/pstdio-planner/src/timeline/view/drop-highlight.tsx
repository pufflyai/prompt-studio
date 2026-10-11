// Tint the destination row and column and fill the cell where the ticket will land. Surfaces mark the target; no outlines.
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
        bg="bg.accent-subtle/50"
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
            bg="bg.accent-subtle/50"
          />
          <Box
            data-drop-cell
            position="absolute"
            left={`${track.x}px`}
            top={`${band.bodyTop}px`}
            w={`${track.width}px`}
            h={`${band.top + band.height - band.bodyTop}px`}
            bg="bg.accent-subtle"
          />
        </>
      ) : null}
    </Box>
  );
}
