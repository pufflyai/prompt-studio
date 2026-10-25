import { Box } from "@chakra-ui/react";
import type { DependencyTimelineProps, TimelineSection } from "./dependency-timeline.types";
import { type BandBox, type geometry, gutterWidth, headerHeight, lineX, padding } from "./timeline-geometry";
import {
  TimelineDate,
  TimelineMarker,
  TimelineSectionBox,
  TimelineSectionHeader,
  TimelineSectionLabel,
} from "./timeline-parts";
import { trackAt } from "./timeline-tracks";

interface SectionsProps extends Pick<DependencyTimelineProps, "sections" | "tracks" | "onDropTarget" | "onDrop"> {
  box: ReturnType<typeof geometry>;
  width: number;
  headerLeft: number;
  zoom: number;
}

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

const DateCell = (props: { section: TimelineSection } & Pick<SectionsProps, "onDropTarget" | "onDrop">) => {
  const { section, onDropTarget, onDrop } = props;
  return (
    <TimelineDate
      data-canvas-control
      onDragOver={(event) => {
        if (!onDropTarget) return;
        event.preventDefault();
        event.stopPropagation();
        onDropTarget({ sectionId: section.id });
      }}
      onDrop={(event) => {
        if (!onDrop) return;
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
    >
      <Box w={`${lineX - 10}px`} textAlign="right" pr="2xs">
        {section.dateLabel ?? shortDate.format(new Date(`${section.date}T00:00:00Z`))}
      </Box>
      <TimelineMarker
        aria-hidden="true"
        left={`${lineX}px`}
        bg={section.complete ? "green.fg" : (section.dateTone ?? "fg.muted")}
      />
    </TimelineDate>
  );
};

const Section = (props: SectionsProps & { band: BandBox; section: TimelineSection }) => {
  const { band, section, box, tracks, width, headerLeft, zoom, onDropTarget, onDrop } = props;
  return (
    <TimelineSectionBox
      data-timeline-section={section.id ?? "unassigned"}
      top={`${band.top}px`}
      h={`${band.height}px`}
      onDragOver={(event) => {
        if (!onDropTarget) return;
        event.preventDefault();
        const x = (event.clientX - (event.currentTarget.parentElement?.getBoundingClientRect().left ?? 0)) / zoom;
        onDropTarget({ sectionId: section.id, trackId: trackAt(box.tracks, tracks, x) });
      }}
      onDrop={(event) => {
        if (!onDrop) return;
        event.preventDefault();
        onDrop();
      }}
    >
      {section.date ? <DateCell section={section} onDropTarget={onDropTarget} onDrop={onDrop} /> : null}
      <TimelineSectionHeader mt={section.date ? `-${headerHeight}px` : undefined}>
        <Box flexShrink="0" w={`${gutterWidth}px`} pointerEvents="none" />
        <Box flexShrink="0" w={`${box.contentLeft - gutterWidth}px`} pointerEvents="none" />
        <TimelineSectionLabel w={`${Math.max(320, width - headerLeft - padding / 2)}px`} data-canvas-control>
          {section.header}
        </TimelineSectionLabel>
      </TimelineSectionHeader>
      {band.rowCount === 0 && !band.collapsed ? <Box pl={`${box.contentLeft}px`}>{section.emptyContent}</Box> : null}
    </TimelineSectionBox>
  );
};

export const TimelineSections = (props: SectionsProps) => {
  const { box, sections } = props;
  return (
    <>
      {box.bands.map((band) => {
        const section = sections.find(({ id }) => id === band.sectionId);
        return section ? <Section key={band.sectionId ?? "none"} {...props} band={band} section={section} /> : null;
      })}
    </>
  );
};
