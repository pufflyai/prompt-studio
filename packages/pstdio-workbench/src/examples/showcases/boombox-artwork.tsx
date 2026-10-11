import { Box } from "@chakra-ui/react";
import { WorkbenchIcon } from "../../react";
import type { BoomboxTrack } from "./boombox-data";

export const Artwork = (props: { size?: string; track: BoomboxTrack }) => (
  <Box
    flexShrink={0}
    boxSize={props.size ?? "12"}
    borderRadius="md"
    bgGradient="to-br"
    gradientFrom={`${props.track.tint}.500`}
    gradientTo="bg.panel"
    display="grid"
    placeItems="center"
  >
    <WorkbenchIcon name="AudioWaveform" color="white" size={20} />
  </Box>
);
