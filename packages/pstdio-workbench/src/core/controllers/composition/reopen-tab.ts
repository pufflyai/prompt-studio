import type { PageLocation, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { pageSlots } from "../../registries/pages/page-main";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pageLocationTarget } from "../page-location/page-location-target";

interface ClosedTab {
  projectId?: string;
  location?: PageLocation;
  placement: WorkbenchWidgetPlacement;
  region: WorkbenchPanelRegion;
  removalVersion: number;
}
const histories = new WeakMap<WorkbenchCore, ClosedTab[]>();
const reopening = new WeakMap<WorkbenchCore, Promise<void>>();
export const rememberClosedTab = (core: WorkbenchCore, tab: ClosedTab) => {
  const history = histories.get(core) ?? [];
  history.push(tab);
  if (history.length > 20) history.shift();
  histories.set(core, history);
};
const latest = (core: WorkbenchCore) =>
  [...(histories.get(core) ?? [])].reverse().find((tab) => tab.projectId === core.pages.store.getState().projectId);
export const registerReopenTab = (core: WorkbenchCore) => {
  core.commands.registerCommand(
    { id: "workbench.reopenClosedTab", label: "Reopen latest tab", category: "Panels and tabs", icon: "RotateCcw" },
    {
      isEnabled: () => Boolean(latest(core)),
      async execute() {
        const tab = latest(core);
        if (!tab) return;
        const history = histories.get(core)!;
        history.splice(history.indexOf(tab), 1);
        const pending = (reopening.get(core) ?? Promise.resolve()).then(() => reopenTab(core, tab));
        reopening.set(
          core,
          pending.catch(() => undefined),
        );
        try {
          await pending;
        } catch (error) {
          history.push(tab);
          throw error;
        }
      },
    },
  );
  core.keybindings.registerKeybinding({
    id: "workbench.reopenClosedTab",
    action: { kind: "command", commandId: "workbench.reopenClosedTab" },
    keybinding: "Alt+Shift+R",
    allowInInputs: true,
  });
};

const reopenPageTab = async (
  core: WorkbenchCore,
  tab: ClosedTab,
  identity: Extract<PlacementIdentity, { kind: "page" }>,
) => {
  const { placement, region } = tab;
  if (tab.location) await core.navigation.openPage(pageLocationTarget(tab.location));
  assertProject(core, tab);
  const page = core.pages.getPage(identity.pageId);
  const slot = page && pageSlots(page).find((slot) => slot.id === identity.slotId);
  core.pages.openSlot({
    pageId: identity.pageId,
    slotId: identity.slotId,
    region,
    resource: placement.resource,
    ...pinIntent(slot?.item),
  });
  const reopened = core.layout.getActivePanel(region);
  if (reopened?.placementIdentity) core.pinPlacement(reopened.placementIdentity);
};

const pinIntent = (item: { kind: string; binding?: { cardinality: string } } | undefined) =>
  item?.kind === "binding" && item.binding?.cardinality === "many" ? { open: "pin" as const } : {};

const assertProject = (core: WorkbenchCore, tab: ClosedTab) => {
  if (core.pages.store.getState().projectId !== tab.projectId)
    throw new Error("Return to the original project to reopen this tab.");
};

const reopenTab = async (core: WorkbenchCore, tab: ClosedTab) => {
  assertProject(core, tab);
  const { placement, region } = tab;
  if (placement.resource && core.resources.wasRemovedSince(placement.resource, tab.removalVersion))
    throw new Error("This resource was removed and cannot be reopened.");
  const identity = placement.placementIdentity;
  const input = { resource: placement.resource, region };
  if (identity?.kind === "page") await reopenPageTab(core, tab, identity);
  else if (identity?.kind === "mode") {
    const declaration = core.modePlacements
      .listPlacements(identity.modeId)
      .find((item) => item.id === identity.placementId);
    if (!declaration) throw new Error("This tab's tool is no longer installed.");
    await core.navigation.openPanel({ ...input, ...pinIntent(declaration.item), panel: declaration.ref });
  } else if (identity?.kind === "shell") {
    const declaration = core.shellPlacements.getPlacement(identity.placementId);
    if (!declaration) throw new Error("This tab's tool is no longer installed.");
    await core.navigation.openPanel({
      ...input,
      ...pinIntent(declaration.item),
      panel: { kind: "shell-placement", id: identity.placementId },
    });
  } else core.layout.openWidget(placement.contributionId, { ...input, title: placement.title, closable: true });
  assertProject(core, tab);
  if (region !== "main") core.shell.setRegionOpen(region, true);
};
