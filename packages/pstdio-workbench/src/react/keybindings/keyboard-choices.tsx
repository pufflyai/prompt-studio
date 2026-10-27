import { ListRow, PaletteShortcut } from "@pstdio/ui";
import type { KeyboardChoice } from "../../core/controllers/keyboard/keyboard-controller";

interface KeyboardChoicesProps {
  entries: KeyboardChoice[];
  search: boolean;
  onActivate(key: string): void;
}

export const KeyboardChoices = (props: KeyboardChoicesProps) => {
  const { entries, search, onActivate } = props;
  return entries.map((entry) => (
    <ListRow
      key={entry.key}
      role="button"
      tabIndex={0}
      data-keyboard-choice={entry.key}
      variant="full-width"
      label={entry.label}
      disabled={entry.disabled}
      endContent={search ? undefined : <PaletteShortcut binding={entry.key} />}
      onActivate={() => onActivate(entry.key)}
    />
  ));
};
