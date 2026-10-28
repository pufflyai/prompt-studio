import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench, workbenchCommandPaletteMenuPath } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchCommandPalette } from "./command-palette";

const createPaletteWorkbench = () => {
  const workbench = createWorkbench();
  for (const [id, label, group, keybinding] of [
    ["workspaces.open", "Open workspaces", "Dashboard", "Alt+Shift+W"],
    ["tickets.open", "Open tickets", "Planner", "Alt+Shift+P"],
    ["notes.create", "New note", "Notes", "Mod+Alt+N"],
  ]) {
    workbench.commands.registerCommand({ id, label, category: group }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: id }, keybinding });
    const placementId = `${id}.palette`;
    workbench.commands.registerCommand({ id: placementId, label, category: group }, { execute: () => undefined });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: placementId,
      sourceCommandId: id,
    });
  }
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Reference/Command palette/Assigned shortcuts",
  component: WorkbenchCommandPalette,
  tags: ["palette-shortcuts"],
  args: { workbench: createPaletteWorkbench(), open: true, initialQuery: ">", onClose: () => undefined },
  render: (args) => (
    <WorkbenchThemeProvider>
      <Box position="relative" h="600px">
        <WorkbenchCommandPalette {...args} />
      </Box>
    </WorkbenchThemeProvider>
  ),
} satisfies Meta<typeof WorkbenchCommandPalette>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AssignedShortcuts: Story = {
  play: async ({ args }) => {
    const canvas = within(document.body);
    const input = await canvas.findByPlaceholderText("Run command");
    for (const [label, key] of [
      ["Open workspaces", "W"],
      ["Open tickets", "P"],
      ["New note", "N"],
    ]) {
      await userEvent.clear(input);
      await userEvent.type(input, `>${label}`);
      const row = await canvas.findByRole("option", { name: new RegExp(label) });
      await expect(within(row).getByText(key, { exact: true })).toBeVisible();
    }
    const binding = args.workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "notes.create" },
      keybinding: "Mod+Alt+M",
    });
    try {
      await expect(await canvas.findByText("M", { exact: true })).toBeVisible();
    } finally {
      binding.dispose();
    }
    await expect(await canvas.findByText("N", { exact: true })).toBeVisible();
  },
};
