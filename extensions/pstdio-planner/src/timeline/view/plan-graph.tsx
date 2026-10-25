import { Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { DependencyTimeline, type TimelineDropTarget } from "@pstdio/ui/dependency-timeline";
import type { PlanDeadline } from "../contracts";
import { isComplete } from "../model/filter";
import type { DropTarget } from "./drag";
import { countdown, formatDay } from "./flags";
import { GraphCard } from "./graph-card";
import { InlineDate, InlineText } from "./inline-edit";
import type { PlanViewProps } from "./plan-view";
import { SectionHeader } from "./section-header";
import { useTimelinePresentation } from "./timeline-presentation";

const dateTone = (deadline: PlanDeadline, complete: boolean) => {
  if (complete) return "fg.muted";
  if (deadline.daysLeft === 0) return "orange.fg";
  return deadline.daysLeft < 0 ? "red.fg" : "fg.muted";
};

interface MilestoneDateProps {
  deadline: PlanDeadline;
  complete: boolean;
  onRedate: PlanViewProps["onRedate"];
}

const MilestoneDate = (props: MilestoneDateProps) => {
  const { deadline, complete, onRedate } = props;
  return (
    <Tooltip content={`${deadline.date} · ${countdown(deadline.daysLeft, complete)}`}>
      <InlineDate
        value={deadline.date}
        display={formatDay(deadline.date).split(", ").pop() ?? deadline.date}
        label={`${deadline.name ?? deadline.date} date`}
        color={dateTone(deadline, complete)}
        onSave={(date) => onRedate(deadline.id, date)}
      />
    </Tooltip>
  );
};

const timelineTarget = (target: DropTarget) =>
  ({
    sectionId: target.deadlineId,
    beforeId: target.beforeId,
    trackId: target.trackId === null ? "unassigned" : target.trackId,
  }) satisfies TimelineDropTarget;

export function PlanGraph(props: PlanViewProps) {
  const { sections, tracks, selectedId, relations, today, dragId, dropTarget, ...actions } = props;
  const presentation = useTimelinePresentation();
  const collapsed = new Set(presentation.value.collapsedTracks);
  return (
    <DependencyTimeline
      aria-label="Project Timeline canvas"
      today={today}
      selectedId={selectedId}
      draggedId={dragId}
      dropTarget={dropTarget ? timelineTarget(dropTarget) : undefined}
      tracks={tracks.list.map((track) => ({
        ...track,
        collapsed: collapsed.has(track.id),
        name:
          track.id === "unassigned" ? undefined : (
            <InlineText
              value={track.label}
              label={`${track.label} track name`}
              color="fg.muted"
              onSave={(name) => actions.onRenameTrack(track.id, name)}
            />
          ),
      }))}
      sections={sections.map((entry) => {
        const deadline = entry.section.deadline;
        const complete = isComplete(entry.section);
        return {
          id: deadline?.id ?? null,
          date: deadline?.date,
          dateTone: deadline ? dateTone(deadline, complete) : undefined,
          complete,
          collapsed: entry.collapsed,
          dateLabel: deadline ? (
            <MilestoneDate deadline={deadline} complete={complete} onRedate={actions.onRedate} />
          ) : undefined,
          header: (
            <SectionHeader
              entry={entry}
              onToggle={actions.onToggle}
              onDelete={actions.onDelete}
              onRenameDeadline={actions.onRenameDeadline}
              onReview={actions.onReview}
            />
          ),
          emptyContent: !deadline ? (
            <Text textAlign="center" pt="md" textStyle="label/S/regular" color="fg.subtle">
              Every ticket has a deadline
            </Text>
          ) : undefined,
          items: entry.rows.map((row) => ({
            id: row.id,
            trackId: row.trackId ?? "unassigned",
            dependencies: row.dependsOn,
            related: relations.has(row.id),
            content: (
              <GraphCard
                row={row}
                interaction={props.cardInteraction}
                relation={relations.get(row.id)}
                onSelect={actions.onSelect}
                onOpenRequests={actions.onOpenRequests}
                onDragStart={actions.onDragStart}
              />
            ),
          })),
        };
      })}
      onToggleTrack={(id) => presentation.toggle("collapsedTracks", id)}
      onAddTrack={actions.onNewTrack}
      onCreateSection={actions.onCreateDeadline}
      onDrop={actions.onDrop}
      onDropTarget={(target) => {
        const next = {
          deadlineId: target.sectionId,
          beforeId: target.beforeId,
          trackId: target.trackId === "unassigned" ? null : target.trackId,
        };
        if (
          next.deadlineId !== dropTarget?.deadlineId ||
          next.beforeId !== dropTarget?.beforeId ||
          next.trackId !== dropTarget?.trackId
        )
          actions.onDragTarget(next);
      }}
      onContext={({ sectionId, trackId, ...point }) =>
        actions.onContext({ ...point, deadlineId: sectionId, trackId: trackId === "unassigned" ? undefined : trackId })
      }
    />
  );
}
