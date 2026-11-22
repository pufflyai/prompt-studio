import { z } from "zod";
import { getWorkbenchPanelForMenuRegion, workbenchPanelMenuRegions } from "../../registries/layout/layout-regions";
import type { WorkbenchCore } from "../../workbench-core-types";

export const menuHeaderPositions = ["top", "right", "bottom", "left"] as const;
export type MenuHeaderPosition = (typeof menuHeaderPositions)[number];
const schema = z
  .object({
    position: z.enum(menuHeaderPositions).optional(),
    order: z.array(z.string()).optional(),
    menuSides: z.record(z.string(), z.enum(["left", "right", "bottom"])).optional(),
  })
  .strict();
export type MenuHeaderSettings = Required<z.infer<typeof schema>>;
const owner = "workbench.menu-header";
const scope = (projectId: string | undefined, viewId: string) => ({
  scope: "user" as const,
  scopeId: JSON.stringify([projectId, viewId]),
});

export const readMenuHeaderSettings = (
  core: WorkbenchCore,
  viewId: string,
  projectId = core.pages.store.getState().projectId,
): MenuHeaderSettings => {
  viewId = core.views.getView(viewId)?.id ?? viewId;
  const saved = schema
    .strip()
    .safeParse(core.preferences.getOwnedValue(owner, "layout", scope(projectId, viewId)) ?? {});
  const value = saved.success ? saved.data : {};
  return {
    position: value.position ?? "top",
    order: value.order ?? [],
    menuSides: value.menuSides ?? {},
  };
};

const writes = new WeakMap<WorkbenchCore, Map<string, Promise<void>>>();

const relocateMenus = (core: WorkbenchCore, viewId: string, sides: MenuHeaderSettings["menuSides"]) => {
  const layout = core.layout.getLayout();
  const regions = { ...layout.regions };
  let changed = false;
  for (const region of Object.values(workbenchPanelMenuRegions).flatMap((sides) => Object.values(sides))) {
    for (const placement of layout.regions[region].widgets) {
      const config = core.layout.getWidget(placement.contributionId)?.config;
      if (
        !config ||
        typeof config !== "object" ||
        !("viewContextId" in config) ||
        typeof config.viewContextId !== "string"
      )
        continue;
      const menu = core.viewMenus.getViewMenu(config.viewContextId);
      const side = sides[config.viewContextId];
      if (!side || menu?.ownerViewId !== viewId) continue;
      const target = workbenchPanelMenuRegions[getWorkbenchPanelForMenuRegion(region)][side];
      if (target === region) continue;
      const source = regions[region];
      const widgets = source.widgets.filter((entry) => entry.widgetId !== placement.widgetId);
      regions[region] = {
        ...source,
        widgets,
        activeWidgetId: source.activeWidgetId === placement.widgetId ? widgets[0]?.widgetId : source.activeWidgetId,
      };
      const destination = regions[target];
      regions[target] = {
        ...destination,
        widgets: [...destination.widgets, placement],
        activeWidgetId: destination.activeWidgetId ?? placement.widgetId,
      };
      changed = true;
    }
  }
  // A presentation preference never selects another resource or fires activation events.
  if (changed) core.layout.restoreLayout({ ...layout, regions });
};

export const configureMenuHeader = (core: WorkbenchCore, viewId: string, patch: z.infer<typeof schema>) => {
  const view = core.views.getView(viewId);
  if (!view) throw new Error(`Unknown menu header view: ${viewId}`);
  viewId = view.id;
  const projectId = core.pages.store.getState().projectId;
  const preferenceScope = scope(projectId, viewId);
  const change = schema.parse(patch);
  let pending = writes.get(core);
  if (!pending) {
    pending = new Map();
    writes.set(core, pending);
  }
  const key = preferenceScope.scopeId;
  const next = (pending.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const previous = readMenuHeaderSettings(core, viewId, projectId);
      const settings = { ...previous, ...change, menuSides: { ...previous.menuSides, ...change.menuSides } };
      await core.preferences.setOwnedValue(owner, "layout", settings, preferenceScope);
      if (change.menuSides && core.pages.store.getState().projectId === projectId)
        relocateMenus(core, viewId, change.menuSides);
    });
  pending.set(key, next);
  void next
    .finally(() => {
      if (pending.get(key) === next) pending.delete(key);
    })
    .catch(() => {});
  return next;
};

export const registerMenuHeaderCommands = (core: WorkbenchCore) => {
  core.commands.registerCommand<{ viewId: string } & z.infer<typeof schema>>(
    {
      id: "workbench.configureMenuHeader",
      label: "Configure menu header",
      category: "Workbench",
      params: {
        viewId: { type: "string", label: "View", required: true },
        position: {
          type: "string",
          label: "Position",
          options: menuHeaderPositions.map((value) => ({ label: value, value })),
        },
      },
    },
    { execute: ({ viewId, ...patch }) => configureMenuHeader(core, viewId, patch) },
  );
};

export const createMenuHeaderSideResolver =
  (getCore: () => WorkbenchCore | undefined) =>
  (
    owner: import("../../registries/layout/layout-types").WorkbenchWidgetPlacement,
    menu: import("../../registries/layout/layout-types").RegisteredWidgetContribution,
  ) => {
    const core = getCore();
    const viewId = owner.viewId ?? core?.layout.getWidget(owner.contributionId)?.rendererId;
    const config = menu.config;
    if (
      !core ||
      !viewId ||
      !config ||
      typeof config !== "object" ||
      !("viewContextId" in config) ||
      typeof config.viewContextId !== "string"
    )
      return;
    return readMenuHeaderSettings(core, viewId).menuSides[config.viewContextId];
  };
