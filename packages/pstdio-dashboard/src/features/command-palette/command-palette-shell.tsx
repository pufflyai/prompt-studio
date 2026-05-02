import { CloseButton, Dialog, HStack, Input, InputGroup, Menu, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ShortcutKbd } from "@/features/shortcuts/shortcut-kbd";
import { CommandPaletteEntriesList } from "./command-palette-entries-list";
import type { buildCommandPaletteEntries, CommandPaletteView } from "./command-palette-model";

interface CommandPaletteShellProps {
  open: boolean;
  query: string;
  view: CommandPaletteView;
  inputIcon: React.ReactNode;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  filteredEntries: ReturnType<typeof buildCommandPaletteEntries>;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  setQuery: (query: string) => void;
  closePalette: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const CommandPaletteShell = (props: CommandPaletteShellProps) => {
  const {
    open,
    query,
    view,
    inputIcon,
    placeholder,
    inputRef,
    filteredEntries,
    activeIndex,
    setActiveIndex,
    setQuery,
    closePalette,
    onKeyDown,
  } = props;
  const { t } = useTranslation("common");

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && closePalette()}>
      <Dialog.Backdrop />
      <Dialog.Positioner alignItems="flex-start" pt="10vh">
        <Dialog.Content maxW="44rem" p="0" overflow="hidden">
          <Dialog.Header px="0" py="0" borderBottomWidth="1px" borderBottomColor="border.muted">
            <InputGroup startElement={inputIcon}>
              <Input
                ref={inputRef}
                value={query}
                placeholder={placeholder}
                aria-label={placeholder}
                autoComplete="off"
                borderWidth="0"
                borderRadius="0"
                h="3rem"
                _focus={{ boxShadow: "none" }}
                _focusVisible={{ boxShadow: "none" }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
              />
            </InputGroup>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" mr="2" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body p="0">
            <ScrollArea maxH="24rem" showHorizontalScrollbar={false}>
              <Menu.Root open closeOnSelect={false}>
                <Menu.Content
                  borderRadius={0}
                  position="static"
                  minW="full"
                  bg="transparent"
                  boxShadow="none"
                  borderWidth="0"
                >
                  <CommandPaletteEntriesList
                    entries={filteredEntries}
                    activeIndex={activeIndex}
                    emptyLabel={t("commandPalette.empty")}
                    onHover={setActiveIndex}
                  />
                </Menu.Content>
              </Menu.Root>
            </ScrollArea>
          </Dialog.Body>
          <Dialog.Footer
            justifyContent="space-between"
            px="sm"
            py="xs"
            borderTopWidth="1px"
            borderTopColor="border.muted"
          >
            <HStack gap="2" color="fg.muted">
              <Text textStyle="label/XS">{t("commandPalette.open")}</Text>
              <ShortcutKbd binding="Ctrl+Shift+P" />
            </HStack>
            <Text textStyle="label/XS" color="fg.muted">
              {view === "theme" ? t("commandPalette.changeTheme") : t("commandPalette.commandHint")}
            </Text>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
