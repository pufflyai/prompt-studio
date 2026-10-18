import type { KanbanRendererContribution } from "../extension-kernel/types";

export const normalizeKanbanViewDefaults = (
  body: Pick<KanbanRendererContribution, "defaultSettings" | "defaultFilter" | "defaultSorts" | "defaultViews">,
) => ({
  defaultSettings: body.defaultSettings ?? {},
  defaultFilter: body.defaultFilter ?? { conjunction: "and" as const, rules: [] },
  defaultSorts: body.defaultSorts ?? [],
  defaultViews: body.defaultViews?.map((view) => ({
    ...view,
    filter: view.filter ?? { conjunction: "and" as const, rules: [] },
    sorts: view.sorts ?? [],
  })),
});
