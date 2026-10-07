// Reuse the Planner's header, filter menu, filter chips, and display placement above the canvas.
import { DEFAULT_KANBAN_RENDERER_SETTINGS, KanbanRendererToolbar } from "@pstdio/ui/kanban-renderer";
import type { ComponentProps } from "react";
import type { DisplaySettings } from "../contracts";
import { DisplayMenu } from "./display-menu";
import { TimelineSearch } from "./timeline-search";

export function PlanHeader({
  data,
  display,
  onDisplayChange,
  search,
  onSearchChange,
  resultLabel,
}: {
  data: Pick<ComponentProps<typeof KanbanRendererToolbar>, "rows" | "attributes" | "storageKey">;
  display: DisplaySettings;
  onDisplayChange: (change: Partial<DisplaySettings>) => void;
  search: string;
  onSearchChange: (value: string) => void;
  resultLabel: string;
}) {
  return (
    <KanbanRendererToolbar
      {...data}
      defaultViews={[
        { id: "default", title: "Ticket timeline", settings: DEFAULT_KANBAN_RENDERER_SETTINGS, filters: {} },
      ]}
      displayControl={<DisplayMenu display={display} onChange={onDisplayChange} />}
      actions={<TimelineSearch value={search} onChange={onSearchChange} resultLabel={resultLabel} />}
    />
  );
}
