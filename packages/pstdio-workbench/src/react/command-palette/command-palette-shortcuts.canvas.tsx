import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
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
  args: { workbench: createPaletteWorkbench(), open: true, initialQuery: ">", onClose: () => undefined },
  render: (args) => (
    <WorkbenchThemeProvider>
      <Box position="relative" h="600px">
        <WorkbenchCommandPalette {...args} />
      </Box>
    </WorkbenchThemeProvider>
  ),
} satisfies CanvasMeta<typeof WorkbenchCommandPalette>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const AssignedShortcuts: Story = {
  id: "pstdio-workbench-reference-command-palette-assigned-shortcuts--assigned-shortcuts",
};
