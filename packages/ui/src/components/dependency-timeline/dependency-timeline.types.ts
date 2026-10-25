import type { ReactNode, Ref } from "react";

export interface TimelineDependency {
  id: string;
  done?: boolean;
}

export interface TimelineItem {
  id: string;
  trackId: string;
  dependencies: TimelineDependency[];
  content: ReactNode;
  /** Highlights the item's dependency edges alongside the selected item. */
  related?: boolean;
}

export interface TimelineTrack {
  id: string;
  label: string;
  /** Optional interactive name, for example an inline editor. */
  name?: ReactNode;
  collapsed?: boolean;
}

export interface TimelineSection {
  id: string | null;
  header: ReactNode;
  items: TimelineItem[];
  collapsed?: boolean;
  date?: string;
  /** Optional interactive date, for example an inline date editor. */
  dateLabel?: ReactNode;
  dateTone?: string;
  complete?: boolean;
  emptyContent?: ReactNode;
}

export interface TimelineDropTarget {
  sectionId: string | null;
  trackId?: string;
  beforeId?: string;
}

export interface TimelineContextTarget {
  x: number;
  y: number;
  sectionId?: string | null;
  trackId?: string;
}

export interface DependencyTimelineProps {
  ref?: Ref<HTMLDivElement>;
  "aria-label"?: string;
  sections: TimelineSection[];
  tracks: TimelineTrack[];
  today: string;
  selectedId?: string;
  draggedId?: string;
  dropTarget?: TimelineDropTarget;
  onDropTarget?: (target: TimelineDropTarget) => void;
  onDrop?: () => void;
  onContext?: (target: TimelineContextTarget) => void;
  onToggleTrack?: (trackId: string) => void;
  onAddTrack?: () => void;
  onCreateSection?: (date: string) => void;
}
