import { resolveArrangement } from "../../registries/layout/panel-positions";
import type { WorkbenchCore } from "../../workbench-core-types";

export const registerKeyboardPanelNavigation = (core: WorkbenchCore) => {
  const destination = (direction: string) => {
    const current = core.keyboard.store.getState().selectedRegion ?? "main";
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
      { id: commandId, label: `Focus panel ${direction}` },
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
      keybinding,
      layer: "view",
      sticky: true,
    });
  }
};
