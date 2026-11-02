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

/** Resource lists share the collection view model, with one fixed display. */
export const normalizeResourceListViewDefaults = (
  body: Pick<
    import("../extension-kernel/types").ResourceListRendererContribution,
    "defaultSettings" | "defaultFilter" | "defaultSorts" | "defaultViews"
  >,
) =>
  normalizeKanbanViewDefaults({
    ...body,
    defaultSettings: {
      ...body.defaultSettings,
      viewMode: "list",
      rowGrouping: "none",
      showChildren: body.defaultSettings?.showChildren ?? true,
    },
    defaultViews: body.defaultViews?.map((view) => ({
      ...view,
      settings: {
        ...view.settings,
        viewMode: "list",
        rowGrouping: "none",
        showChildren: view.settings.showChildren ?? body.defaultSettings?.showChildren ?? true,
      },
    })),
  });
