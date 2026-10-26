import { Dialog, Input, Stack, Text } from "@chakra-ui/react";
import { ListRow, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { shortcutDisplayKeys, shortcutOpeningChord } from "../../core/controllers/keyboard/shortcut-menu";
import { getKeybindingSteps } from "../../core/registries/keybindings/keybinding-registry";
import { WorkbenchShortcutKeys } from "./shortcut-keys";
import { useShortcutCatalog } from "./use-shortcut-catalog";

const ShortcutRow = (props: {
  shortcut: ResolvedShortcut;
  owner: string;
  openingChord: string;
  catalog: ResolvedShortcut[];
}) => {
  const { shortcut, owner, openingChord, catalog } = props;
  const assigned = getKeybindingSteps(shortcut.binding.keybinding).length > 0;
  let status = "Unassigned";
  if (assigned) status = shortcut.disabled ? "Inactive" : "Assigned";
  return (
    <Stack role="group" aria-label={shortcut.label} gap="0">
      <ListRow
        variant="full-width"
        label={shortcut.label}
        description={`${owner} · ${shortcut.binding.layer ?? "Direct"} · ${status}`}
        endContent={
          assigned ? (
            <WorkbenchShortcutKeys shortcut={shortcut} openingChord={openingChord} catalog={catalog} />
          ) : undefined
        }
      />
    </Stack>
  );
};

interface KeyboardShortcutsPanelProps {
  workbench: WorkbenchCore;
  initialFilter?: string;
  ownerLabels?: Record<string, string>;
}

export const WorkbenchKeyboardShortcutsPanel = (props: KeyboardShortcutsPanelProps) => {
  const { workbench, initialFilter = "", ownerLabels = {} } = props;
  const [query, setQuery] = useState(initialFilter);
  const { catalog } = useShortcutCatalog(workbench);
  const openingChord = shortcutOpeningChord(catalog);
  const owner = (shortcut: ResolvedShortcut) =>
    ownerLabels[shortcut.binding.sourceExtensionId ?? ""] ?? shortcut.binding.sourceExtensionLabel ?? "Core";
  const filtered = catalog.filter((shortcut) =>
    `${shortcut.label} ${shortcut.id} ${owner(shortcut)} ${shortcutDisplayKeys(shortcut, openingChord, catalog).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <Stack gap="0" minW="0">
      <Dialog.Header>
        <Text textStyle="heading/S">Keyboard shortcuts</Text>
      </Dialog.Header>
      <Input
        aria-label="Search keyboard shortcuts"
        placeholder="Search action, extension, or keys"
        size="sm"
        variant="borderless"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Dialog.Body p="0">
        <ScrollArea maxH="palette-results-height" showHorizontalScrollbar={false}>
          {filtered.map((shortcut) => (
            <ShortcutRow
              key={shortcut.id}
              shortcut={shortcut}
              owner={owner(shortcut)}
              openingChord={openingChord}
              catalog={catalog}
            />
          ))}
        </ScrollArea>
      </Dialog.Body>
    </Stack>
  );
};
