import { Palette, PaletteShortcut } from "@pstdio/ui";
import { WorkbenchIcon } from "../../../shared/icon";

export default { title: "Proposals/PS-1138 Clear commands" };

export const ClearCommands = () => (
  <Palette
    open
    initialQuery=">"
    modes={[{ id: "command", inputPrefix: ">" }]}
    placeholder="Run command"
    onClose={() => undefined}
    entries={[
      ["navigation", "Go back", "Navigation", "ArrowLeft", "Alt+Shift+ArrowLeft"],
      ["projects", "Switch project", "Projects", "Folder", ""],
      ["notes", "New note", "Notes", "StickyNote", "Alt+Shift+K → N → N"],
      ["terminal", "Open terminal", "Main panel", "SquareTerminal", ""],
      ["session", "New session", "Main panel", "MessageCircle", ""],
      ["side-session", "New session", "Side panel", "MessageCircle", ""],
      ["theme", "Choose color theme", "Appearance", "Palette", "Alt+Shift+T"],
    ].map(([id, label, group, icon, binding]) => ({
      id,
      label,
      group,
      mode: "command",
      searchText: `${label} ${group}`,
      icon: <WorkbenchIcon name={icon} />,
      shortcut: binding ? <PaletteShortcut binding={binding} /> : undefined,
      onActivate: () => undefined,
    }))}
  />
);
