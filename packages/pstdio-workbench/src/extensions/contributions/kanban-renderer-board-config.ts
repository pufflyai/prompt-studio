import type { KanbanRendererBoardColumnConfig as WireBoardColumnConfig } from "@pstdio/sdk/extensions";
import { createElement } from "react";
import { WorkbenchIcon } from "../../react";
import type { ReactKanbanRendererContribution as KanbanRendererContribution } from "../../react/renderers/kanban/kanban-presentation";
import type { Localizer } from "./kanban-renderer-contribution-helpers";

type BoardColumnConfig = ReturnType<NonNullable<KanbanRendererContribution["getBoardColumnConfig"]>>;

const createBoardActionIcon = (icon: string | undefined) => {
  const BoardActionIcon = (props: { size?: number | string }) =>
    createElement(WorkbenchIcon, { name: icon ?? "MoreHorizontal", ...props });
  return BoardActionIcon;
};

export const toWorkbenchBoardColumnConfig = (config: WireBoardColumnConfig | undefined, localize: Localizer) =>
  ({
    color: config?.color,
    canCreate: config?.canCreate,
    actions: config?.actions?.map((action) => ({
      id: action.id,
      label: localize(action.label, action.id),
      icon: createBoardActionIcon(action.icon),
    })),
  }) satisfies BoardColumnConfig;
