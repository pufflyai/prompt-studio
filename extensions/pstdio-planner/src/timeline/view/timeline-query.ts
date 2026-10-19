import { EMPTY_VIEW_FILTER } from "@pstdio/ui/collection-view";
import { DEFAULT_KANBAN_RENDERER_SETTINGS } from "@pstdio/ui/kanban-renderer";
import { DEFAULT_TIMELINE_DISPLAY_PROPERTIES } from "../../data/ticket-board";

export { timelineQueryData } from "../model/query-data";

export const timelineInitialState = {
  settings: { ...DEFAULT_KANBAN_RENDERER_SETTINGS, displayProperties: DEFAULT_TIMELINE_DISPLAY_PROPERTIES },
  filter: EMPTY_VIEW_FILTER,
  sorts: [],
};
