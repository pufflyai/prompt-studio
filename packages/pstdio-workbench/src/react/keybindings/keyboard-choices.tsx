import { ListRow, PaletteShortcut } from "@pstdio/ui";
import type { KeyboardChoice } from "../../core/controllers/keyboard/keyboard-controller";

interface KeyboardChoicesProps {
  entries: KeyboardChoice[];
  path: string[];
  search: boolean;
  onActivate(key: string): void;
}

export const KeyboardChoices = (props: KeyboardChoicesProps) => {
  const { entries, path, search, onActivate } = props;
  return entries.map((entry) => (
    <ListRow
      key={entry.key}
      role="button"
      tabIndex={0}
      data-keyboard-choice={entry.key}
      variant="full-width"
      label={entry.label}
      disabled={entry.disabled}
      endContent={
        search || (path.length === 1 && path[0] === "E" && entry.key.length > 1) ? undefined : (
          <PaletteShortcut binding={entry.key} />
        )
      }
      onActivate={() => onActivate(entry.key)}
    />
  ));
};
