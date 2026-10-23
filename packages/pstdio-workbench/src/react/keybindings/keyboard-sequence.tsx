import { Text } from "@chakra-ui/react";
import { PaletteShortcut } from "@pstdio/ui";
import type { KeyboardState } from "../../core/controllers/keyboard/keyboard-controller";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { shortcutOpeningChord, shortcutPathLabels } from "../../core/controllers/keyboard/shortcut-menu";

interface KeyboardSequenceProps {
  state: KeyboardState;
  catalog: ResolvedShortcut[];
}

export const KeyboardSequence = (props: KeyboardSequenceProps) => {
  const { state, catalog } = props;
  const opening = shortcutOpeningChord(catalog);
  const steps = [...state.path, ...(state.lastKey ? [state.lastKey] : [])];
  const extension = state.path[0] === "E" && state.path[1] && state.path[1].length > 1;
  if (!extension) return <PaletteShortcut binding={[opening, ...steps]} />;
  return (
    <>
      <PaletteShortcut binding={[opening, "E"]} />
      <Text textStyle="label/XS/regular">{shortcutPathLabels(catalog, state.path)[1]}</Text>
      {steps.length > 2 ? <PaletteShortcut binding={steps.slice(2)} /> : null}
    </>
  );
};
