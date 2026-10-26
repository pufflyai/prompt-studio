import { Box } from "@chakra-ui/react";
import { useImperativeHandle } from "react";
import { Canvas } from "../canvas";
import type { DependencyTimelineProps } from "./dependency-timeline.types";
import { TimelineContent } from "./timeline-content";
import { geometry, newTrackWidth, trackHeaderHeight } from "./timeline-geometry";
import { layoutTimeline } from "./timeline-layout";
import { TimelineRoot } from "./timeline-parts";
import { TrackHeader } from "./timeline-tracks";
import { useItemHeights } from "./use-item-heights";
import { useRevealItem } from "./use-reveal-item";
import { useTimelineCamera } from "./use-timeline-camera";
import { useTimelineSize } from "./use-timeline-size";

export const DependencyTimeline = (props: DependencyTimelineProps) => {
  const { ref: forwardedRef, sections, tracks, selectedId, "aria-label": label = "Dependency timeline" } = props;
  const { ref, width, height } = useTimelineSize();
  const camera = useTimelineCamera(ref);
  const { zoom } = camera;
  const layout = layoutTimeline(sections, tracks);
  const heights = useItemHeights(ref, layout.nodes.map(({ id }) => id).join(","));
  const box = geometry(layout, heights);
  useImperativeHandle(forwardedRef, () => ref.current!);
  useRevealItem({ ref, selectedId, box, zoom });
  const canvasWidth = Math.max(box.width + (props.onAddTrack ? newTrackWidth : 0), width / zoom);
  const canvasHeight = Math.max(box.height, height / zoom - trackHeaderHeight);
  return (
    <TimelineRoot>
      <Canvas ref={ref} aria-label={label} data-timeline-viewport variant="pan" {...camera}>
        <Box data-timeline-scale css={{ zoom }} w={`${canvasWidth}px`}>
          <TrackHeader {...props} boxes={box.tracks} width={canvasWidth} contentLeft={box.contentLeft} />
          <TimelineContent
            {...props}
            box={box}
            viewport={ref}
            width={width}
            height={height}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            zoom={zoom}
          />
        </Box>
      </Canvas>
    </TimelineRoot>
  );
};
