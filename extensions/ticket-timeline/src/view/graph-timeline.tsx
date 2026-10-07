// Draw the milestone timeline line in the graph's left gutter and preview a new milestone where it is hovered.
// Each milestone's date and marker belong to its sticky header row, which sits on this line.
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { ChevronRight, Plus } from "lucide-react";
import { type MouseEvent, useRef, useState } from "react";
import type { PlanSection } from "../contracts";
import { ghostDate, type TimelineAnchor } from "../model/calendar";
import type { DropTarget } from "./drag";
import { formatDay } from "./flags";
import { type BandBox, gutterWidth, headerHeight, lineX, padding } from "./graph-geometry";
import { graphLayers } from "./graph-layers";

interface Props {
  bands: BandBox[];
  sections: PlanSection[];
  today: string;
  height: number;
  contentLeft: number;
  zoom: number;
  dropTarget?: DropTarget;
  onCreate: (date: string) => void;
}

interface Dated {
  band: BandBox;
  section: PlanSection & { deadline: NonNullable<PlanSection["deadline"]> };
  y: number;
}

const Line = ({ top, height, dotted }: { top: number; height: number; dotted?: boolean }) => (
  <Box
    position="absolute"
    left={`${lineX - 1}px`}
    top={`${top}px`}
    h={`${Math.max(0, height)}px`}
    borderLeftWidth="2px"
    borderStyle={dotted ? "dotted" : "solid"}
    borderColor="border"
    pointerEvents="none"
  />
);

const Bubble = ({ y, color, ghost }: { y: number; color: string; ghost?: boolean }) => (
  <Box
    position="absolute"
    left={`${lineX}px`}
    top={`${y}px`}
    transform="translate(-50%, -50%)"
    boxSize="12px"
    borderRadius="full"
    borderWidth="2px"
    borderStyle={ghost ? "dashed" : "solid"}
    borderColor={ghost ? "fg.muted" : "bg"}
    bg={ghost ? "bg" : color}
    pointerEvents="none"
  />
);

function useGhost(anchors: TimelineAnchor[], today: string, dragging: boolean, zoom: number) {
  const [ghost, setGhost] = useState<{ y: number; date: string }>();
  const ghostRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const move = (event: MouseEvent<HTMLElement>) => {
    const y = (event.clientY - (gutterRef.current?.getBoundingClientRect().top ?? 0)) / zoom;
    // Hovering an existing milestone shows that milestone rather than a new one.
    const onMilestone = anchors.some((anchor) => Math.abs(anchor.y - y) < headerHeight / 2 + 4);
    setGhost(dragging || onMilestone ? undefined : { y, date: ghostDate(anchors, y, today) });
  };
  // Moving between the line and the preview keeps the preview, so it can be clicked.
  const leave = (event: MouseEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    const inside = (element: HTMLElement | null) => next instanceof Node && element?.contains(next);
    if (!inside(ghostRef.current) && !inside(gutterRef.current)) {
      setGhost(undefined);
    }
  };
  return { ghost, ghostRef, gutterRef, move, leave };
}

export function GraphTimeline({ bands, sections, today, height, contentLeft, zoom, dropTarget, onCreate }: Props) {
  const dated = bands.flatMap((band) => {
    const section = sections.find(({ deadline }) => deadline?.id === band.deadlineId);
    return section?.deadline ? [{ band, section, y: band.top + headerHeight / 2 } as Dated] : [];
  });
  const anchors = dated.map(({ y, section }) => ({ y, date: section.deadline.date }));
  const { ghost, ghostRef, gutterRef, move, leave } = useGhost(anchors, today, dropTarget !== undefined, zoom);
  const first = dated[0]?.y ?? padding;
  const last = dated[dated.length - 1]?.y ?? padding;

  return (
    <>
      <Box
        ref={gutterRef}
        position="sticky"
        left="0"
        zIndex={graphLayers.gutter}
        w={`${gutterWidth}px`}
        h={`${height}px`}
        bg="bg"
        cursor={ghost ? "pointer" : undefined}
        aria-label="Milestone timeline"
        data-canvas-control
        onMouseMove={move}
        onMouseLeave={leave}
        onClick={() => ghost && onCreate(ghost.date)}
      >
        <Line top={first} height={last - first} />
        <Line top={last} height={height - last} dotted />
        {ghost ? <Bubble y={ghost.y} color="bg" ghost /> : null}
      </Box>
      {ghost ? (
        <Flex
          ref={ghostRef}
          role="button"
          data-canvas-control
          aria-label={`Create milestone on ${ghost.date}`}
          position="absolute"
          zIndex={graphLayers.milestone}
          left={`${contentLeft}px`}
          right={`${padding / 2}px`}
          top={`${ghost.y - headerHeight / 2}px`}
          h={`${headerHeight}px`}
          align="center"
          gap="sm"
          px="sm"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="fg.muted"
          borderRadius="md"
          bg="bg"
          opacity="0.8"
          color="fg.muted"
          cursor="pointer"
          onMouseLeave={leave}
          onClick={() => onCreate(ghost.date)}
        >
          <Icon as={ChevronRight} boxSize="14px" />
          <Icon as={Plus} boxSize="14px" />
          <Text textStyle="label/S/medium">New milestone · {formatDay(ghost.date)}</Text>
        </Flex>
      ) : null}
    </>
  );
}
