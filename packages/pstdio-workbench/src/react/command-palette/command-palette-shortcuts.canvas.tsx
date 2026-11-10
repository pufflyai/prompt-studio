import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench, workbenchCommandPaletteMenuPath } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchCommandPalette } from "./command-palette";

const createPaletteWorkbench = () => {
  const workbench = createWorkbench();
  for (const [id, label, group, keybinding, icon] of [
    ["workspaces.open", "Open workspaces", "Workspaces", "Alt+Shift+W", "FolderGit2"],
    ["tickets.open", "Open tickets", "Tickets", "Alt+Shift+P", "SquareKanban"],
    ["notes.create", "New note", "Notes", "N", "StickyNote"],
  ]) {
    workbench.commands.registerCommand({ id, label, category: group, icon }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: id },
      keybinding,
      layer: id === "notes.create" ? "create" : undefined,
    });
    const placementId = `${id}.palette`;
    workbench.commands.registerCommand({ id: placementId, label, category: group }, { execute: () => undefined });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: placementId,
      sourceCommandId: id,
    });
  }
  for (const [id, title, icon] of [
    ["terminal", "Open terminal", "SquareTerminal"],
    ["session", "New session", "MessageCircle"],
  ]) {
    workbench.layout.registerPanel({ id, title, icon, region: "main", rendererId: id, eligibleLocations: {} });
  }
  return workbench;
};
const meta = {
  title: "Product/Workbench/Commands/Assigned shortcuts",
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
