import type { WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import { openPanelWidget } from "../composition/panel-widget-open";
import { registerKeyboardPanelNavigation } from "./keyboard-panel-navigation";
import { regionLabel, visibleKeyboardRegions } from "./keyboard-presentations";

const regions: WorkbenchPanelRegion[] = ["main", "secondary", "side"];
export const registerKeyboardPanelCommands = (core: WorkbenchCore) => {
  registerKeyboardPanelNavigation(core);
  const register = (name: string, label: string, key: string, execute: () => void | Promise<void>, sticky = false) => {
    const id = `workbench.keyboard.${name}`;
    core.commands.registerCommand({ id, label }, { execute });
    core.keybindings.registerKeybinding({
      id,
      action: { kind: "command", commandId: id },
      keybinding: key,
      layer: "view",
      sticky,
    });
  };
  core.commands.registerCommand(
    { id: "workbench.keyboard.newTab", label: "New tab" },
    {
      execute: (args?: { panelId?: string; resourceKind?: string }) => {
        core.keyboard.select(
          "New tab · destination",
          regions
            .filter((region) =>
              core.composition
                .panelsFor(region)
                .addable.some(
                  (panel) =>
                    (!args?.panelId || panel.contribution.id === args.panelId) &&
                    (!args?.resourceKind || Boolean(panel.contribution.resourceKinds?.includes(args.resourceKind))),
                ),
            )
            .map((region, index) => ({
              key: String(index + 1),
              label: regionLabel(region),
              choose: () => {
                const panels = core.composition
                  .panelsFor(region)
                  .addable.filter(
                    (panel) =>
                      (!args?.panelId || panel.contribution.id === args.panelId) &&
                      (!args?.resourceKind || Boolean(panel.contribution.resourceKinds?.includes(args.resourceKind))),
                  );
                core.keyboard.select(
                  "New tab · panel type",
                  panels.map((panel, index) => ({
                    key: String(index + 1),
                    label: panel.contribution.title,
                    choose: async () => {
                      if (
                        !core.composition
                          .panelsFor(region)
                          .addable.some((current) => current.contribution.id === panel.contribution.id)
                      ) {
                        core.keyboard.message("This panel is no longer available.");
                        return;
                      }
                      core.keyboard.close(false);
                      await openPanelWidget({
                        workbench: core,
                        widget: panel.contribution,
                        region,
                        resource: core.getPrimaryResource(),
                        open: panel.open,
                        pinned: panel.pinned,
                      });
                    },
                  })),
                );
              },
            })),
        );
      },
    },
  );
  core.keybindings.registerKeybinding({
    id: "workbench.keyboard.newTab",
    action: { kind: "command", commandId: "workbench.keyboard.newTab" },
    keybinding: "N",
    layer: "view",
  });
  register("moveTab", "Move tab", "O", () => {
    const tabs = core.keyboard
      .visibleTargets()
      .filter((tab) => core.getPanelDestinations(tab.id).some((region) => region !== tab.region));
    core.keyboard.select(
      "Move tab",
      tabs.map((tab, index) => ({
        key: String(index + 1),
        label: `${tab.label} · ${regionLabel(tab.region)}`,
        choose: () => {
          core.keyboard.select(
            "Move tab · destination",
            core
              .getPanelDestinations(tab.id)
              .filter((region) => region !== tab.region)
              .map((region, index) => ({
                key: String(index + 1),
                label: regionLabel(region),
                choose: () => {
                  const current = core.keyboard.listTabs().find((current) => current.id === tab.id);
                  if (
                    !current ||
                    current.resource?.id !== tab.resource?.id ||
                    !core.getPanelDestinations(tab.id).includes(region)
                  ) {
                    core.keyboard.message("This tab is no longer available.");
                    return;
                  }
                  core.movePanel(tab.id, region);
                  core.keyboard.close(false);
                },
              })),
          );
        },
      })),
    );
  });
  register("reposition", "Reposition panel", "R", () => {
    core.keyboard.select(
      "Reposition panel",
      visibleKeyboardRegions(core)
        .filter((region) => core.shell.getPanelPositions(region).length)
        .map((region, index) => ({
          key: String(index + 1),
          label: regionLabel(region),
          choose: () => {
            core.keyboard.select(
              "Panel position",
              core.shell.getPanelPositions(region).map((position, index) => ({
                key: String(index + 1),
                label: position,
                choose: () => {
                  core.shell.repositionPanel(region, position);
                  core.keyboard.close(false);
                },
              })),
            );
          },
        })),
    );
  });
  register(
    "focus",
    "Focus panel",
    "F",
    () =>
      core.keyboard.select(
        "Focus panel",
        core.keyboard.visibleTargets().map((tab, index) => ({
          key: String(index + 1),
          label: `${tab.label} · ${regionLabel(tab.region)}`,
          choose: () => {
            core.keyboard.selectPresentation(tab.id, tab.resource?.id);
          },
        })),
      ),
    true,
  );
  register("closeTab", "Close tab", "X", () =>
    core.keyboard.select(
      "Close tab",
      core.keyboard
        .visibleTargets()
        .filter((tab) => core.composition.panelsFor(tab.region).closable.includes(tab.id))
        .map((tab, index) => ({
          key: String(index + 1),
          label: `${tab.label} · ${regionLabel(tab.region)}`,
          choose: () => {
            if (
              core.keyboard
                .listTabs()
                .some((current) => current.id === tab.id && current.resource?.id === tab.resource?.id)
            ) {
              if (tab.placementIdentity) core.closePlacement(tab.placementIdentity);
              else core.layout.closePanel(tab.id);
            }
            core.keyboard.close(false);
          },
        })),
    ),
  );
  register("pinTab", "Pin or unpin tab", "P", () =>
    core.keyboard.select(
      "Pin or unpin tab",
      core.keyboard
        .visibleTargets()
        .filter((tab) => tab.tabRetention)
        .map((tab, index) => ({
          key: String(index + 1),
          label: `${tab.tabRetention === "preview" ? "Pin" : "Unpin"} ${tab.label} · ${regionLabel(tab.region)}`,
          choose: () => {
            const current = core.keyboard
              .listTabs()
              .find(
                (current) =>
                  current.id === tab.id &&
                  current.resource?.id === tab.resource?.id &&
                  current.tabRetention === tab.tabRetention,
              );
            if (!current) {
              core.keyboard.message("This tab is no longer available.");
              return;
            }
            const pinned = tab.tabRetention === "preview";
            if (tab.placementIdentity) core.pinPlacement(tab.placementIdentity, pinned);
            else core.layout.updatePanel(tab.id, { strategy: { kind: pinned ? "persistent" : "preview" } });
            core.keyboard.close(false);
          },
        })),
    ),
  );
};
