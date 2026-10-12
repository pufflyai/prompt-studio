import { EMPTY_VIEW_FILTER } from "@pstdio/ui/collection-view";
import { DEFAULT_KANBAN_RENDERER_SETTINGS } from "@pstdio/ui/kanban-renderer";

export { timelineQueryData } from "../model/query-data";

export const timelineInitialState = {
  settings: DEFAULT_KANBAN_RENDERER_SETTINGS,
  filter: EMPTY_VIEW_FILTER,
  sorts: [],
};
