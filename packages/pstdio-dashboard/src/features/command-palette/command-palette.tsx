import { type ThemePreference, type ThemePreferenceOption, toaster, useThemePreference } from "@pstdio/ui";
import { useNavigate } from "@tanstack/react-router";
import { Palette, Search, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useExecuteExtensionCommand,
  useProjectExtensionMetadata,
} from "@/shared/extensions/hooks/use-project-extensions";
import { buildExtensionCommandRequest } from "@/shared/extensions/slot-context";
import { runCommandPaletteAction } from "./command-palette-actions";
import { handleCommandPaletteKeyDown } from "./command-palette-keyboard";
import {
  buildCommandPaletteEntries,
  type CommandPaletteSession,
  type CommandPaletteTicket,
  type CommandPaletteView,
  filterCommandPaletteEntries,
  resolveCommandPaletteMode,
} from "./command-palette-model";
import { CommandPaletteShell } from "./command-palette-shell";

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
  initialQuery?: string;
  projectId: string;
  tickets: CommandPaletteTicket[];
  sessions: CommandPaletteSession[];
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

export const CommandPalette = (props: CommandPaletteProps) => {
  const {
    open,
    initialView = "main",
    initialQuery = "",
    projectId,
    tickets,
    sessions,
    requestCreateTicket,
    createSession,
    openShortcutHelp,
    onClose,
  } = props;
  const navigate = useNavigate();
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  const { t } = useTranslation(["common", "projects"]);
  const { data: extensionMetadata } = useProjectExtensionMetadata(projectId);
  const executeExtensionCommand = useExecuteExtensionCommand(projectId);
  const [view, setView] = useState<CommandPaletteView>(initialView);
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const themePreviewRef = useRef<ThemePreviewState | null>(null);
  const setupRef = useRef({ initialView, initialQuery, open: false });
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

  const runExtensionCommand = (commandId: string) => {
    executeExtensionCommand.mutate(
      {
        commandId,
        body: buildExtensionCommandRequest({
          projectId,
          slotId: "project.commandPanel",
          kind: "menu",
        }),
      },
      {
        onError: (error) =>
          toaster.create({ type: "error", title: "Extension command failed", description: error.message }),
      },
    );
  };

  const handleRun: Parameters<typeof buildCommandPaletteEntries>[0]["run"] = (action) =>
    runCommandPaletteAction(action, {
      projectId,
      navigate,
      beginThemePreview,
      commitThemePreview,
      closePalette,
      requestCreateTicket,
      createSession,
      openShortcutHelp,
      runExtensionCommand,
    });

  const entries = buildCommandPaletteEntries({
    projectId,
    tickets,
    sessions,
    currentTheme: themePreference,
    themePreferences,
    extensions: extensionMetadata?.extensions,
    extensionCommands: extensionMetadata?.commands,
    extensionMenuContributions: extensionMetadata?.menuContributions,
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
    setupRef.current = { initialView, initialQuery, open };
    if (!open) return;

    const shouldInitialize =
      !previousSetup.open || previousSetup.initialView !== initialView || previousSetup.initialQuery !== initialQuery;
    if (!shouldInitialize) return;

    setView(initialView);
    setQuery(initialQuery);
    if (initialView === "theme") {
      themePreviewRef.current = { baseTheme: themePreference };
      setActiveIndex(getThemeEntryIndex(themePreference, themePreferences));
    } else {
      themePreviewRef.current = null;
      setActiveIndex(0);
    }
    const timeout = setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
    }, 0);
    return () => clearTimeout(timeout);
  }, [initialQuery, initialView, open, themePreference, themePreferences]);

  useEffect(() => {
    if (!open || view !== "theme") return;

    const action = filteredEntries[activeIndex]?.action;
    if (action?.type !== "theme" || action.preference === themePreference) return;

    setThemePreference(action.preference);
  }, [activeIndex, filteredEntries, open, setThemePreference, themePreference, view]);

  const runActiveEntry = () => {
    filteredEntries[activeIndex]?.run();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) =>
    handleCommandPaletteKeyDown(event, {
      query,
      view,
      entryCount: filteredEntries.length,
      setActiveIndex,
      setQuery,
      runActiveEntry,
      exitThemePreview,
      closePalette,
    });

  return (
    <CommandPaletteShell
      open={open}
      query={query}
      view={view}
      inputIcon={inputIcon}
      placeholder={placeholder}
      inputRef={inputRef}
      filteredEntries={filteredEntries}
      activeIndex={activeIndex}
      setActiveIndex={setActiveIndex}
      setQuery={setQuery}
      closePalette={closePalette}
      onKeyDown={handleKeyDown}
    />
  );
};
