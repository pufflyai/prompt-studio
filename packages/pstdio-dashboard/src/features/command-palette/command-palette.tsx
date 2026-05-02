import { CloseButton, Dialog, HStack, Icon, Input, InputGroup, Menu, Text } from "@chakra-ui/react";
import {
  ListRow,
  type ListRowItem,
  ScrollArea,
  type ThemePreference,
  type ThemePreferenceOption,
  useThemePreference,
} from "@pstdio/ui";
import { useNavigate } from "@tanstack/react-router";
import { Check, Palette, Search, Terminal } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShortcutKbd } from "@/features/shortcuts/shortcut-kbd";
import {
  buildCommandPaletteEntries,
  type CommandPaletteAction,
  type CommandPaletteTicket,
  type CommandPaletteView,
  filterCommandPaletteEntries,
  resolveCommandPaletteEscapeAction,
  resolveCommandPaletteMode,
} from "./command-palette-model";

export {
  buildCommandPaletteEntries,
  type CommandPaletteView,
  filterCommandPaletteEntries,
  resolveCommandPaletteEscapeAction,
  resolveCommandPaletteMode,
} from "./command-palette-model";

interface CommandPaletteProps {
  open: boolean;
  initialView?: CommandPaletteView;
  projectId: string;
  tickets: CommandPaletteTicket[];
  requestCreateTicket: () => void;
  createSession: () => void;
  openShortcutHelp: () => void;
  onClose: () => void;
}

interface ThemePreviewState {
  baseTheme: ThemePreference;
}

const getThemeEntryIndex = (preference: ThemePreference, themePreferences: readonly ThemePreferenceOption[]) => {
  const index = themePreferences.findIndex((theme) => theme.id === preference);

  return Math.max(index, 0);
};

const buildEntryItem = (entry: ReturnType<typeof buildCommandPaletteEntries>[number]): ListRowItem => ({
  id: entry.id,
  label: entry.label,
  description: entry.secondaryLabel,
  icon: <Icon as={entry.icon} boxSize="14px" />,
  endContent:
    entry.shortcut || entry.isSelected ? (
      <HStack gap="2">
        {entry.shortcut ? <ShortcutKbd binding={entry.shortcut} /> : null}
        {entry.isSelected ? <Icon as={Check} boxSize="14px" color="fg.muted" /> : null}
      </HStack>
    ) : undefined,
  onActivate: entry.run,
});

export const CommandPalette = (props: CommandPaletteProps) => {
  const {
    open,
    initialView = "main",
    projectId,
    tickets,
    requestCreateTicket,
    createSession,
    openShortcutHelp,
    onClose,
  } = props;
  const navigate = useNavigate();
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  const { t } = useTranslation(["common", "projects"]);
  const [view, setView] = useState<CommandPaletteView>(initialView);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const themePreviewRef = useRef<ThemePreviewState | null>(null);
  const setupRef = useRef({ initialView, open: false });
  const mode = resolveCommandPaletteMode(query);

  const beginThemePreview = () => {
    themePreviewRef.current = { baseTheme: themePreference };
    setView("theme");
    setQuery("");
    setActiveIndex(getThemeEntryIndex(themePreference, themePreferences));
  };

  const commitThemePreview = (preference: ThemePreference) => {
    themePreviewRef.current = null;
    setThemePreference(preference);
    onClose();
  };

  const exitThemePreview = () => {
    const preview = themePreviewRef.current;
    themePreviewRef.current = null;

    if (preview) {
      setThemePreference(preview.baseTheme);
    }

    setView("main");
    setQuery("");
    setActiveIndex(0);
  };

  const closePalette = () => {
    const preview = themePreviewRef.current;
    themePreviewRef.current = null;

    if (preview) {
      setThemePreference(preview.baseTheme);
    }

    onClose();
  };

  const handleRun = (action: CommandPaletteAction) => {
    if (action.type === "open-theme-menu") {
      beginThemePreview();
      return;
    }

    if (action.type === "theme") {
      commitThemePreview(action.preference);
      return;
    }

    closePalette();

    if (action.type === "navigate") {
      navigate({ to: action.path });
      return;
    }

    if (action.type === "create-ticket") {
      requestCreateTicket();
      navigate({ to: `/projects/${projectId}/tickets` });
      return;
    }

    if (action.type === "create-session") {
      createSession();
      return;
    }

    if (action.type === "open-shortcut-help") {
      openShortcutHelp();
      return;
    }
  };

  const entries = buildCommandPaletteEntries({
    projectId,
    tickets,
    currentTheme: themePreference,
    themePreferences,
    labels: {
      tickets: t("projects:sidebar.tickets"),
      sessions: t("projects:sessions.title"),
      projectSettings: t("projects:sidebar.projectSettings"),
      createTicket: t("common:commandPalette.createTicket"),
      createSession: t("common:commandPalette.createSession"),
      keyboardShortcuts: t("common:commandPalette.keyboardShortcuts"),
      changeTheme: t("common:commandPalette.changeTheme"),
      themeLabel: (preference) => t(`common:themes.${preference}`, { defaultValue: preference }),
    },
    run: handleRun,
  });
  const filteredEntries = filterCommandPaletteEntries(entries, query, view);
  const inputIcon =
    view === "theme" ? <Palette size={16} /> : mode === "command" ? <Terminal size={16} /> : <Search size={16} />;
  const placeholder =
    view === "theme"
      ? t("common:commandPalette.themePlaceholder")
      : mode === "command"
        ? t("common:commandPalette.commandPlaceholder")
        : t("common:commandPalette.searchPlaceholder");

  useEffect(() => {
    const previousSetup = setupRef.current;
    setupRef.current = { initialView, open };
    if (!open) return;

    const shouldInitialize = !previousSetup.open || previousSetup.initialView !== initialView;
    if (!shouldInitialize) return;

    setView(initialView);
    setQuery("");
    if (initialView === "theme") {
      themePreviewRef.current = { baseTheme: themePreference };
      setActiveIndex(getThemeEntryIndex(themePreference, themePreferences));
    } else {
      themePreviewRef.current = null;
      setActiveIndex(0);
    }
    const timeout = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [initialView, open, themePreference, themePreferences]);

  useEffect(() => {
    if (!open || view !== "theme") return;

    const action = filteredEntries[activeIndex]?.action;
    if (action?.type !== "theme" || action.preference === themePreference) return;

    setThemePreference(action.preference);
  }, [activeIndex, filteredEntries, open, setThemePreference, themePreference, view]);

  const runActiveEntry = () => {
    filteredEntries[activeIndex]?.run();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filteredEntries.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runActiveEntry();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      const escapeAction = resolveCommandPaletteEscapeAction(query, view);

      if (escapeAction === "clear") {
        setQuery("");
        setActiveIndex(0);
        return;
      }

      if (escapeAction === "exit-view") {
        exitThemePreview();
        return;
      }

      closePalette();
    }
  };

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
                onKeyDown={handleKeyDown}
              />
            </InputGroup>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" mr="2" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body p="0">
            <ScrollArea maxH="24rem" showHorizontalScrollbar={false}>
              <Menu.Root open closeOnSelect={false}>
                <Menu.Content position="static" minW="full" bg="transparent" boxShadow="none" borderWidth="0" p="2xs">
                  {filteredEntries.length > 0 ? (
                    filteredEntries.map((entry, index) => {
                      const previousEntry = filteredEntries[index - 1];
                      const showSeparator = previousEntry?.id.startsWith("nav:") && entry.id.startsWith("ticket:");
                      return (
                        <Fragment key={entry.id}>
                          {showSeparator ? <Menu.Separator my="2xs" /> : null}
                          <Menu.Item value={entry.id} asChild onMouseEnter={() => setActiveIndex(index)}>
                            <ListRow
                              asChild
                              variant="compact"
                              {...buildEntryItem(entry)}
                              isSelected={index === activeIndex}
                            />
                          </Menu.Item>
                        </Fragment>
                      );
                    })
                  ) : (
                    <Text textStyle="paragraph/S/regular" color="fg.muted" px="sm" py="md">
                      {t("common:commandPalette.empty")}
                    </Text>
                  )}
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
              <Text textStyle="label/XS">{t("common:commandPalette.open")}</Text>
              <ShortcutKbd binding="Ctrl+Shift+P" />
            </HStack>
            <Text textStyle="label/XS" color="fg.muted">
              {view === "theme" ? t("common:commandPalette.changeTheme") : t("common:commandPalette.commandHint")}
            </Text>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
