// Share the graph's props and the selected ticket's relations.
import type { PlanRow, PlanSection } from "../contracts";
import type { buildTracks } from "../model/tracks";
import type { BackgroundContext } from "./background-menu";
import type { DropTarget } from "./drag";

// How a card relates to the selected ticket.
export type Relation = "selected" | "needed-first" | "waits-on-selected";

export interface ViewSection {
  section: PlanSection;
  // Only the rows matching the shared ticket filters and search.
  rows: PlanRow[];
  collapsed: boolean;
}

export interface PlanViewProps {
  sections: ViewSection[];
  tracks: ReturnType<typeof buildTracks>;
  relations: Map<string, Relation>;
  selectedId?: string;
  dragId?: string;
  dropTarget?: DropTarget;
  today: string;
  onContext: (context: BackgroundContext) => void;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragTarget: (target: DropTarget) => void;
  onDrop: () => void;
  onToggle: (deadlineId: string | null) => void;
  onDelete: (deadlineId: string) => void;
  onRenameDeadline: (deadlineId: string, name: string) => Promise<unknown>;
  onRedate: (deadlineId: string, date: string) => Promise<unknown>;
  onRenameTrack: (trackId: string, name: string) => Promise<unknown>;
  // Open the milestone's tickets that need a person in the side panel.
  onReview: (deadlineId: string | null) => void;
  onNewTrack: () => void;
  onCreateDeadline: (date: string) => void;
}
