// Draw one milestone section: a header line that sticks below the track names while the section is in view,
// carrying the milestone's date on the timeline and a drop target for its tickets.
import { Box, Flex, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import type { DragEvent } from "react";
import type { PlanDeadline } from "../contracts";
import { isComplete } from "../model/filter";
import { type DropTarget, sameTarget } from "./drag";
import { countdown, formatDay } from "./flags";
import { type BandBox, gutterWidth, headerHeight, lineX, padding, trackHeaderHeight } from "./graph-geometry";
import { graphLayers } from "./graph-layers";
import { InlineDate } from "./inline-edit";
import type { PlanViewProps, ViewSection } from "./plan-view";
import { SectionHeader } from "./section-header";

type BandActions = Pick<
  PlanViewProps,
  "dropTarget" | "onDrop" | "onToggle" | "onDelete" | "onRenameDeadline" | "onRedate" | "onReview"
>;

interface BandProps extends BandActions {
  band: BandBox;
  // Visible graph width: the header line ends at the visible edge, so progress and delete stay on screen.
  viewWidth: number;
  contentLeft: number;
  headerLeft: number;
  zoom: number;
  entry: ViewSection;
  over: (target: DropTarget) => void;
  trackAt: (x: number) => string | null;
}

function dueColor(deadline: PlanDeadline, complete: boolean) {
  if (complete) {
    return "fg.muted";
  }

  if (deadline.daysLeft === 0) {
    return "orange.fg";
  }

  return deadline.daysLeft < 0 ? "red.fg" : "fg.muted";
}

// The date and its marker sit on the timeline line and stay at the left edge while the canvas pans sideways.
function DateCell({
  deadline,
  complete,
  targeted,
  over,
  onDrop,
  onRedate,
}: {
  deadline: PlanDeadline;
  complete: boolean;
  targeted: boolean;
  over: (target: DropTarget) => void;
} & Pick<BandActions, "onDrop" | "onRedate">) {
  const color = dueColor(deadline, complete);
  return (
    <Flex
      position="sticky"
      left="0"
      top={`${trackHeaderHeight}px`}
      zIndex={graphLayers.date}
      flexShrink="0"
      w={`${gutterWidth}px`}
      h={`${headerHeight}px`}
      bg="bg"
      align="center"
      onDragOver={(event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        over({ deadlineId: deadline.id });
      }}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
    >
      {targeted ? <Box position="absolute" inset="0" bg="border.accent/6" pointerEvents="none" /> : null}
      <Tooltip content={`${deadline.date} · ${countdown(deadline.daysLeft, complete)}`}>
        <Box w={`${lineX - 10}px`} textAlign="right" pr="2xs">
          <InlineDate
            value={deadline.date}
            display={formatDay(deadline.date).split(", ").pop() ?? deadline.date}
            label={`${deadline.name ?? deadline.date} date`}
            color={color}
            onSave={(date) => onRedate(deadline.id, date)}
          />
        </Box>
      </Tooltip>
      <Box
        aria-hidden="true"
        position="absolute"
        left={`${lineX}px`}
        top="50%"
        transform="translate(-50%, -50%)"
        boxSize="12px"
        borderRadius="full"
        borderWidth="2px"
        borderColor="bg"
        bg={complete ? "green.fg" : color}
      />
    </Flex>
  );
}

export function Band({
  band,
  entry,
  viewWidth,
  contentLeft,
  headerLeft,
  zoom,
  dropTarget,
  over,
  trackAt,
  ...actions
}: BandProps) {
  const deadline = entry.section.deadline;
  // Keep the destination date and milestone name visible above the canvas preview.
  const targeted = dropTarget?.deadlineId === band.deadlineId;
  return (
    <Box
      position="absolute"
      left="0"
      right={`${padding / 2}px`}
      top={`${band.top}px`}
      h={`${band.height}px`}
      onDragOver={(event: DragEvent) => {
        event.preventDefault();
        const x = (event.clientX - (event.currentTarget.parentElement?.getBoundingClientRect().left ?? 0)) / zoom;
        const target = { deadlineId: band.deadlineId, trackId: trackAt(x) };
        if (!sameTarget(dropTarget, target)) {
          over(target);
        }
      }}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        actions.onDrop();
      }}
    >
      {deadline ? (
        <DateCell
          deadline={deadline}
          complete={isComplete(entry.section)}
          targeted={targeted}
          over={over}
          onDrop={actions.onDrop}
          onRedate={actions.onRedate}
        />
      ) : null}
      <Flex
        position="sticky"
        top={`${trackHeaderHeight}px`}
        zIndex={graphLayers.milestone}
        h={`${headerHeight}px`}
        mt={deadline ? `-${headerHeight}px` : undefined}
      >
        <Box flexShrink="0" w={`${gutterWidth}px`} pointerEvents="none" />
        <Box flexShrink="0" w={`${contentLeft - gutterWidth}px`} pointerEvents="none" />
        <Box
          position="sticky"
          left={`${gutterWidth}px`}
          flexShrink="0"
          w={`${Math.max(320, viewWidth - headerLeft - padding / 2)}px`}
          minW="0"
        >
          <SectionHeader
            entry={entry}
            targeted={targeted}
            onToggle={actions.onToggle}
            onDelete={actions.onDelete}
            onRenameDeadline={actions.onRenameDeadline}
            onReview={actions.onReview}
          />
        </Box>
      </Flex>
      {band.rowCount === 0 && !band.collapsed && !deadline ? (
        <Text textAlign="center" pt="md" pl={`${contentLeft}px`} textStyle="label/S/regular" color="fg.subtle">
          Every ticket has a deadline
        </Text>
      ) : null}
    </Box>
  );
}
