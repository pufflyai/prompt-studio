import { Icon, Text } from "@chakra-ui/react";
import { ChevronRight, Plus } from "lucide-react";
import { type MouseEvent, useRef, useState } from "react";
import type { DependencyTimelineProps } from "./dependency-timeline.types";
import { ghostDate, type TimelineAnchor } from "./timeline-calendar";
import { type BandBox, headerHeight, lineX, padding } from "./timeline-geometry";
import { TimelineGutter, TimelineLine, TimelineMarker, TimelinePreview } from "./timeline-parts";

interface GutterProps extends Pick<DependencyTimelineProps, "sections" | "today" | "onCreateSection" | "dropTarget"> {
  bands: BandBox[];
  height: number;
  contentLeft: number;
  zoom: number;
}

const dayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const useGhost = (anchors: TimelineAnchor[], today: string, dragging: boolean, zoom: number) => {
  const [ghost, setGhost] = useState<{ y: number; date: string }>();
  const ghostRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const move = (event: MouseEvent<HTMLElement>) => {
    const y = (event.clientY - (gutterRef.current?.getBoundingClientRect().top ?? 0)) / zoom;
    const onSection = anchors.some((anchor) => Math.abs(anchor.y - y) < headerHeight / 2 + 4);
    setGhost(dragging || onSection ? undefined : { y, date: ghostDate(anchors, y, today) });
  };
  const leave = (event: MouseEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    const inside = (element: HTMLElement | null) => next instanceof Node && element?.contains(next);
    if (!inside(ghostRef.current) && !inside(gutterRef.current)) setGhost(undefined);
  };
  return { ghost, ghostRef, gutterRef, move, leave };
};

export const MilestoneGutter = (props: GutterProps) => {
  const { bands, sections, today, height, contentLeft, zoom, dropTarget, onCreateSection } = props;
  const anchors = bands.flatMap((band) => {
    const section = sections.find(({ id }) => id === band.sectionId);
    return section?.date ? [{ y: band.top + headerHeight / 2, date: section.date }] : [];
  });
  const { ghost, ghostRef, gutterRef, move, leave } = useGhost(anchors, today, dropTarget !== undefined, zoom);
  const first = anchors[0]?.y ?? padding;
  const last = anchors.at(-1)?.y ?? padding;
  return (
    <>
      <TimelineGutter
        ref={gutterRef}
        h={`${height}px`}
        cursor={ghost && onCreateSection ? "pointer" : undefined}
        aria-label="Milestone timeline"
        data-canvas-control={onCreateSection ? "" : undefined}
        onMouseMove={onCreateSection ? move : undefined}
        onMouseLeave={leave}
        onClick={() => ghost && onCreateSection?.(ghost.date)}
      >
        <TimelineLine left={`${lineX - 1}px`} top={`${first}px`} h={`${last - first}px`} borderStyle="solid" />
        <TimelineLine
          left={`${lineX - 1}px`}
          top={`${last}px`}
          h={`${Math.max(0, height - last)}px`}
          borderStyle="dotted"
        />
        {ghost && onCreateSection ? (
          <TimelineMarker
            left={`${lineX}px`}
            top={`${ghost.y}px`}
            bg="bg"
            borderStyle="dashed"
            borderColor="bg.accent-primary.default"
          />
        ) : null}
      </TimelineGutter>
      {ghost && onCreateSection ? (
        <TimelinePreview
          ref={ghostRef}
          role="button"
          tabIndex={0}
          data-canvas-control
          aria-label={`Create milestone on ${ghost.date}`}
          left={`${contentLeft}px`}
          top={`${ghost.y - headerHeight / 2}px`}
          onMouseLeave={leave}
          onClick={() => onCreateSection(ghost.date)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onCreateSection(ghost.date);
          }}
        >
          <Icon as={ChevronRight} boxSize="icon-xs" />
          <Icon as={Plus} boxSize="icon-xs" />
          <Text textStyle="label/S/medium">New milestone · {dayLabel.format(new Date(`${ghost.date}T00:00:00Z`))}</Text>
        </TimelinePreview>
      ) : null}
    </>
  );
};
