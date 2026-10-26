import { PaletteShortcut } from "@pstdio/ui";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { shortcutDisplayKeys } from "../../core/controllers/keyboard/shortcut-menu";

interface WorkbenchShortcutKeysProps {
  shortcut: ResolvedShortcut;
  openingChord: string;
  catalog?: ResolvedShortcut[];
}

export const WorkbenchShortcutKeys = (props: WorkbenchShortcutKeysProps) => {
  const { shortcut, openingChord, catalog } = props;
  return <PaletteShortcut binding={shortcutDisplayKeys(shortcut, openingChord, catalog)} />;
};
