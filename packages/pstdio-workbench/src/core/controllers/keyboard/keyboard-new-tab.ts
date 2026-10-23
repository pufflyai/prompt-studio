import type { WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import { openPanelWidget } from "../composition/panel-widget-open";
import { regionLabel } from "./keyboard-presentations";

const regions: WorkbenchPanelRegion[] = ["main", "secondary", "side"];
export const registerKeyboardNewTab = (core: WorkbenchCore) => {
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
};
