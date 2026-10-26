import { HStack, Stack, Text } from "@chakra-ui/react";
import { ListRow, SearchModalContent } from "@pstdio/ui";
import { Fragment, useState } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { shortcutDisplayKeys, shortcutOpeningChord } from "../../core/controllers/keyboard/shortcut-menu";
import { createShortcutReference } from "../../core/controllers/keyboard/shortcut-reference";
import { WorkbenchIcon } from "../shared/icon";
import { WorkbenchShortcutKeys } from "./shortcut-keys";
import { useShortcutCatalog } from "./use-shortcut-catalog";

const ShortcutRow = (props: {
  entry: ReturnType<typeof createShortcutReference>[number];
  openingChord: string;
  catalog: ResolvedShortcut[];
}) => {
  const { entry, openingChord, catalog } = props;
  return (
    <Stack role="group" aria-label={entry.label} gap="0">
      <ListRow
        variant="full-width"
        label={entry.label}
        disabled={entry.disabled}
        endContent={
          <HStack gap="sm">
            {entry.shortcuts.map((shortcut) => (
              <WorkbenchShortcutKeys
                key={shortcut.id}
                shortcut={shortcut}
                openingChord={openingChord}
                catalog={catalog}
              />
            ))}
          </HStack>
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
  const entries = createShortcutReference(workbench, catalog, ownerLabels);
  const filtered = entries.filter((entry) =>
    `${entry.label} ${entry.group} ${entry.shortcuts.map((shortcut) => `${shortcut.id} ${shortcut.binding.sourceExtensionId ?? ""} ${shortcut.binding.sourceExtensionLabel ?? ""} ${shortcutDisplayKeys(shortcut, openingChord, catalog).join(" ")}`).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <SearchModalContent
      title="Keyboard shortcuts"
      searchValue={query}
      searchPlaceholder="Search keyboard shortcuts"
      searchIcon={<WorkbenchIcon name="search" size={16} />}
      scrollAreaProps={{ maxH: "palette-results-height" }}
      onSearchChange={setQuery}
    >
      <Stack gap="0">
        {filtered.map((entry, index) => (
          <Fragment key={entry.id}>
            {entry.group !== filtered[index - 1]?.group ? (
              <Text as="h3" textStyle="label/XS/medium" color="fg.muted" px="sm" pt="xs" pb="2xs">
                {entry.group}
              </Text>
            ) : null}
            <ShortcutRow entry={entry} openingChord={openingChord} catalog={catalog} />
          </Fragment>
        ))}
        {!filtered.length ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted" px="sm" py="md">
            No matching shortcuts.
          </Text>
        ) : null}
      </Stack>
    </SearchModalContent>
  );
};
