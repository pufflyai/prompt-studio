import { Input, Stack, Text } from "@chakra-ui/react";
import { createWorkbench } from "../../core";

export const createKeyboardWorkbench = (count = 4) => {
  const workbench = createWorkbench({ initialSidePanelMode: "attached" });
  workbench.commands.registerCommand(
    { id: "find.inactive", label: "Find inactive action" },
    { isVisible: () => false, execute() {} },
  );
  workbench.commands.registerCommand({ id: "find.available", label: "Find available action" }, { execute() {} });
  workbench.modes.registerMode({ id: "keyboard", activate() {} });
  workbench.modes.setActiveMode("keyboard");
  workbench.views.registerView({
    id: "keyboard-editor",
    title: "Editor",
    body: {
      kind: "react",
      render: ({ instance }) => (
        <Stack p="sm">
          <Text>{instance.resource?.label}</Text>
          <Input aria-label={`Draft ${instance.resource?.id}`} defaultValue={`Draft ${instance.resource?.id}`} />
        </Stack>
      ),
    },
  });
  workbench.layout.registerWidget({
    id: "ticket",
    title: "Ticket",
    region: "main",
    rendererId: "keyboard-editor",
    closable: true,
    singleton: false,
    reuse: "none",
    mountStrategy: "keep-mounted",
  });
  for (let number = 1; number <= count; number++) {
    let region: "main" | "secondary" | "side" = "main";
    if (number === count) region = "secondary";
    else if (number === count - 1) region = "side";
    workbench.layout.setRegionVisible(region, true);
    workbench.layout.openWidget("ticket", {
      region,
      viewId: "keyboard-editor",
      role: "location",
      tabRetention: "persistent",
      resource: { type: "ticket", id: String(number), label: `PS-${number}` },
    });
  }
  workbench.commands.registerCommand(
    { id: "ticket.status", label: "Change ticket status" },
    {
      execute: (_args, context) => {
        workbench.keyboard.message(`Updated ${context?.resource?.id}`);
      },
    },
  );
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "ticket.status" },
    keybinding: "S",
    layer: "current",
    targetScope: "resource",
  });
  return workbench;
};
