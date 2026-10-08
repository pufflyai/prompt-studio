import { Dialog, Flex, Menu, Stack, Text } from "@chakra-ui/react";
import { ListRow, PaletteShortcut, ScrollArea } from "@pstdio/ui";
import { useWorkbenchStore, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { buildShortcutEntries, type ShortcutEntry } from "./shortcut-entries";

const ShortcutHints = (props: { shortcut: ShortcutEntry }) => {
  const { shortcut } = props;
  return (
    <Flex gap="xs" align="center" flexWrap="wrap">
      {shortcut.keybindings.length > 0 ? (
        shortcut.keybindings.map((binding) => <PaletteShortcut key={JSON.stringify(binding)} binding={binding} />)
      ) : (
        <Text textStyle="label/S/regular" color="fg.muted" whiteSpace="nowrap">
          Not assigned
        </Text>
      )}
    </Flex>
  );
};

export const ShortcutReference = (props: { shortcuts: ShortcutEntry[] }) => {
  const { shortcuts } = props;
  const categories = [...new Set(shortcuts.map((entry) => entry.category))];
  return (
    <Stack gap="0" minW="0">
      <Dialog.Header pr="10">
        <Text textStyle="heading/S">Keyboard shortcuts</Text>
      </Dialog.Header>
      <Dialog.Body>
        <ScrollArea maxH="24rem" showHorizontalScrollbar={false} contentProps={{ pr: "2xs" }}>
          <Menu.Root open closeOnSelect={false}>
            <Menu.Content position="static" minW="full" maxW="full" bg="transparent" borderWidth="0">
              {categories.map((category) => (
                <Menu.ItemGroup key={category}>
                  <Menu.ItemGroupLabel>{category}</Menu.ItemGroupLabel>
                  {shortcuts
                    .filter((entry) => entry.category === category)
                    .map((shortcut) => (
                      <Menu.Item key={shortcut.id} value={shortcut.id} asChild>
                        <ListRow
                          variant="full-width"
                          label={shortcut.label}
                          tooltip={shortcut.label}
                          description={
                            shortcut.keybindings.length > 1 ? <ShortcutHints shortcut={shortcut} /> : undefined
                          }
                          endContent={
                            shortcut.keybindings.length <= 1 ? <ShortcutHints shortcut={shortcut} /> : undefined
                          }
                        />
                      </Menu.Item>
                    ))}
                </Menu.ItemGroup>
              ))}
            </Menu.Content>
          </Menu.Root>
        </ScrollArea>
      </Dialog.Body>
    </Stack>
  );
};

export const KeyboardShortcutsWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const workbench = input.workbench;
  const keybindings = useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const menus = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const pages = useWorkbenchStore(workbench.pages.store, (state) => state.pages);
  const views = useWorkbenchStore(workbench.views.store, (state) => state.views);
  const widgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const [navigation, setNavigation] = useState(() => ({
    navigationActions: workbench.navigationTrees.listActions(),
    modePlacements: workbench.modePlacements.listPlacements(),
  }));
  useEffect(() => {
    const refresh = () =>
      setNavigation({
        navigationActions: workbench.navigationTrees.listActions(),
        modePlacements: workbench.modePlacements.listPlacements(),
      });
    const subscription = workbench.navigationTrees.onDidChange(refresh);
    const placements = workbench.modePlacements.onDidChange(refresh);
    refresh();
    return () => {
      subscription.dispose();
      placements.dispose();
    };
  }, [workbench]);
  return (
    <ShortcutReference
      shortcuts={buildShortcutEntries({ keybindings, commands, menus, pages, views, widgets, ...navigation })}
    />
  );
};
