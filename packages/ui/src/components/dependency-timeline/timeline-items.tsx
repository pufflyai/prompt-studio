import { DropIndicator } from "../primitives/drop-indicator";
import type { DependencyTimelineProps, TimelineItem } from "./dependency-timeline.types";
import type { geometry } from "./timeline-geometry";
import { TimelineItemBox } from "./timeline-parts";

interface ItemsProps extends Pick<DependencyTimelineProps, "sections" | "dropTarget" | "onDropTarget" | "onDrop"> {
  items: TimelineItem[];
  box: ReturnType<typeof geometry>;
}

export const TimelineItems = (props: ItemsProps) => {
  const { items, sections, box, dropTarget, onDropTarget, onDrop } = props;
  return (
    <>
      {items.map((item) => {
        const position = box.positions.get(item.id);
        if (!position) return null;
        const section = sections.find(({ items }) => items.some(({ id }) => id === item.id))!;
        return (
          <TimelineItemBox
            key={item.id}
            data-timeline-item={item.id}
            data-canvas-control
            data-related={item.related ? "" : undefined}
            left={`${position.x}px`}
            top={`${position.y}px`}
            onDragOver={(event) => {
              if (!onDropTarget) return;
              event.preventDefault();
              event.stopPropagation();
              onDropTarget({ sectionId: section.id, trackId: item.trackId, beforeId: item.id });
            }}
            onDrop={(event) => {
              if (!onDrop) return;
              event.preventDefault();
              event.stopPropagation();
              onDrop();
            }}
          >
            {dropTarget?.beforeId === item.id && dropTarget.sectionId === section.id ? (
              <DropIndicator top="-sm" />
            ) : null}
            {item.content}
          </TimelineItemBox>
        );
      })}
    </>
  );
};
