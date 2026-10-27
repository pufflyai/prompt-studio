import { resolveArrangement } from "../../registries/layout/panel-positions";
import type { WorkbenchCore } from "../../workbench-core-types";

export const registerKeyboardPanelNavigation = (core: WorkbenchCore) => {
  const destination = (direction: string) => {
    const state = core.keyboard.store.getState();
    const active = core.keyboard
      .visibleTargets()
      .find((target) => target.id === core.layout.getLayout().activeWidgetId);
    const current = state.active
      ? (state.selectedRegion ?? "main")
      : (core.focus.getActiveRegion() ?? active?.region ?? "main");
    const arrangement = resolveArrangement(core.layout.getLayout().arrangement);
    const transitions: Record<string, Record<string, string>> = {
      main: { [arrangement.side]: "side", [arrangement.secondary === "top" ? "up" : "down"]: "secondary" },
      secondary: { [arrangement.side]: "side", [arrangement.secondary === "top" ? "down" : "up"]: "main" },
      side: { [arrangement.side === "left" ? "right" : "left"]: "main" },
    };
    const region = transitions[current]?.[direction];
    return core.keyboard.visibleTargets().find((target) => target.region === region);
  };
  for (const [direction, keybinding] of [
    ["left", "H"],
    ["right", "L"],
    ["up", "U"],
    ["down", "D"],
  ] as const) {
    const commandId = `workbench.keyboard.focus.${direction}`;
    core.commands.registerCommand(
      { id: commandId, label: `Focus panel ${direction}`, category: "Panels and tabs" },
      {
        isEnabled: () => Boolean(destination(direction)),
        execute: () => {
          const target = destination(direction);
          if (target) core.keyboard.selectPresentation(target.id, target.resource?.id);
        },
      },
    );
    core.keybindings.registerKeybinding({
      action: { kind: "command", commandId },
      keybinding: `Alt+Shift+${keybinding}`,
      allowInInputs: true,
    });
  }
};
