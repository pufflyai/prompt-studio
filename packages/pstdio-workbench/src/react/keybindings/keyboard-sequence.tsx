import { PaletteShortcut } from "@pstdio/ui";
import type { KeyboardState } from "../../core/controllers/keyboard/keyboard-controller";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { shortcutOpeningChord } from "../../core/controllers/keyboard/shortcut-menu";

interface KeyboardSequenceProps {
  state: KeyboardState;
  catalog: ResolvedShortcut[];
}

export const KeyboardSequence = (props: KeyboardSequenceProps) => {
  const { state, catalog } = props;
  const opening = shortcutOpeningChord(catalog);
  const steps = [...state.path, ...(state.lastKey ? [state.lastKey] : [])];
  return <PaletteShortcut binding={[opening, ...steps]} />;
};
