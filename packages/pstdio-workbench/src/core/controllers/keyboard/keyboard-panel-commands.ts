import type { WorkbenchCore } from "../../workbench-core-types";
import { registerKeyboardNewTab } from "./keyboard-new-tab";
import { registerKeyboardPanelNavigation } from "./keyboard-panel-navigation";
import { presentationResourceKey, regionLabel, visibleKeyboardRegions } from "./keyboard-presentations";

export const registerKeyboardPanelCommands = (core: WorkbenchCore) => {
  registerKeyboardPanelNavigation(core);
  registerKeyboardNewTab(core);
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
                  const current = core.keyboard.visibleTargets().find((current) => current.id === tab.id);
                  if (
                    !current ||
                    presentationResourceKey(current) !== presentationResourceKey(tab) ||
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
        .filter((tab) => core.composition.panelsFor(tab.region).closable.includes(tab.contributionId))
        .map((tab, index) => ({
          key: String(index + 1),
          label: `${tab.label} · ${regionLabel(tab.region)}`,
          choose: () => {
            if (
              core.keyboard
                .visibleTargets()
                .some(
                  (current) =>
                    current.id === tab.id && presentationResourceKey(current) === presentationResourceKey(tab),
                )
            ) {
              if (tab.placementIdentity) core.closePlacement(tab.placementIdentity);
              else core.layout.closePanel(tab.id);
            } else {
              core.keyboard.message("This tab is no longer available.");
              return;
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
              .visibleTargets()
              .find(
                (current) =>
                  current.id === tab.id &&
                  presentationResourceKey(current) === presentationResourceKey(tab) &&
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
