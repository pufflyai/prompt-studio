import { toWorkbenchBoardColumnConfig } from "./kanban-renderer-board-config";
import type { Localizer, MutableAttributeSource, QueryResult } from "./kanban-renderer-contribution-helpers";

/** Reuse presentation callbacks when a refresh returns unchanged column rules. */
export const createKanbanQueryPresentation = (attributes: MutableAttributeSource, localize: Localizer) => {
  let signature: string | undefined;
  let configs: Record<string, ReturnType<typeof toWorkbenchBoardColumnConfig>> = {};
  return (value: QueryResult) => {
    const next = JSON.stringify(value.boardColumnConfigs);
    if (next !== signature) {
      signature = next;
      configs = Object.fromEntries(
        Object.entries(value.boardColumnConfigs ?? {}).map(([id, config]) => [
          id,
          toWorkbenchBoardColumnConfig(config, localize),
        ]),
      );
    }
    return {
      attributes: value.attributes === undefined ? undefined : attributes.resolve(value.attributes),
      boardColumnConfigs: configs,
    };
  };
};
