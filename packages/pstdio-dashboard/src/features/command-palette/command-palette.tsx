import { HStack, Icon, Text } from "@chakra-ui/react";
import {
  type PaletteEntry,
  type PaletteMode,
  PaletteShortcut,
  Palette as PaletteSurface,
  type ThemePreference,
  type ThemePreferenceOption,
  toaster,
  useThemePreference,
} from "@pstdio/ui";
import { useNavigate } from "@tanstack/react-router";
import { Palette as PaletteIcon, Search, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useExecuteExtensionCommand,
  useProjectExtensionMetadata,
} from "@/shared/extensions/hooks/use-project-extensions";
import { buildExtensionCommandRequest } from "@/shared/extensions/slot-context";
import { runCommandPaletteAction } from "./command-palette-actions";
import {
  buildCommandPaletteEntries,
  type CommandPaletteEntry,
  type CommandPaletteMode,
  type CommandPaletteSession,
  type CommandPaletteTicket,
  type CommandPaletteView,
  filterCommandPaletteEntries,
  resolveCommandPaletteEscapeAction,
} from "./command-palette-model";

export {
  buildCommandPaletteEntries,
  type CommandPaletteView,
  DEFAULT_COMMAND_PALETTE_ASSET_LIMIT,
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

type DashboardPaletteEntry = PaletteEntry & {
  mode: CommandPaletteEntry["mode"];
  assetType?: CommandPaletteEntry["assetType"];
  action: CommandPaletteEntry["action"];
};

const getThemeEntryIndex = (preference: ThemePreference, themePreferences: readonly ThemePreferenceOption[]) => {
  const index = themePreferences.findIndex((theme) => theme.id === preference);

  return Math.max(index, 0);
};

const commandPaletteModes: PaletteMode[] = [{ id: "search" }, { id: "command", inputPrefix: ">" }];

const toCommandPaletteMode = (mode?: string): CommandPaletteMode | undefined =>
  mode === "command" || mode === "search" ? mode : undefined;

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
  const themePreviewRef = useRef<ThemePreviewState | null>(null);
  const setupRef = useRef({ initialView, initialQuery, open: false });

  const beginThemePreview = () => {
    themePreviewRef.current = { baseTheme: themePreference };
    setView("theme");
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
  const paletteInitialQuery = view === "theme" && initialView !== "theme" ? "" : initialQuery;
  const paletteEntries = entries.map<DashboardPaletteEntry>((entry) => ({
    id: entry.id,
    mode: entry.mode,
    label: entry.label,
    searchText: entry.searchText,
    secondaryLabel: entry.secondaryLabel,
    icon: <Icon as={entry.icon} boxSize="14px" />,
    shortcut: entry.shortcut ? <PaletteShortcut binding={entry.shortcut} /> : undefined,
    group: entry.group,
    assetType: entry.assetType,
    isSelected: entry.isSelected,
    action: entry.action,
    onActivate: entry.run,
  }));

  useEffect(() => {
    const previousSetup = setupRef.current;
    setupRef.current = { initialView, initialQuery, open };
    if (!open) return;

    const shouldInitialize =
      !previousSetup.open || previousSetup.initialView !== initialView || previousSetup.initialQuery !== initialQuery;
    if (!shouldInitialize) return;

    setView(initialView);
    if (initialView === "theme") {
      themePreviewRef.current = { baseTheme: themePreference };
    } else {
      themePreviewRef.current = null;
    }
  }, [initialQuery, initialView, open, themePreference]);

  return (
    <PaletteSurface
      key={`${view}:${paletteInitialQuery}`}
      open={open}
      entries={paletteEntries}
      initialQuery={paletteInitialQuery}
      initialActiveIndex={view === "theme" ? getThemeEntryIndex(themePreference, themePreferences) : 0}
      mode={view === "theme" ? "theme" : undefined}
      modes={view === "theme" ? undefined : commandPaletteModes}
      resetKey={`${view}:${paletteInitialQuery}`}
      inputIcon={({ mode }) =>
        view === "theme" ? (
          <PaletteIcon size={16} />
        ) : mode === "command" ? (
          <Terminal size={16} />
        ) : (
          <Search size={16} />
        )
      }
      placeholder={({ mode }) =>
        view === "theme"
          ? t("common:commandPalette.themePlaceholder")
          : mode === "command"
            ? t("common:commandPalette.commandPlaceholder")
            : t("common:commandPalette.searchPlaceholder")
      }
      emptyLabel={t("common:commandPalette.empty")}
      filterEntries={(currentEntries, query, mode) =>
        filterCommandPaletteEntries(currentEntries, query, view, toCommandPaletteMode(mode))
      }
      footerStart={
        <HStack gap="2" color="fg.muted">
          <Text textStyle="label/XS">{t("common:commandPalette.open")}</Text>
          <PaletteShortcut binding="Ctrl+Shift+P" />
        </HStack>
      }
      footerEnd={
        <Text textStyle="label/XS" color="fg.muted">
          {view === "theme" ? t("common:commandPalette.changeTheme") : t("common:commandPalette.commandHint")}
        </Text>
      }
      onActiveEntryChange={(entry) => {
        if (!open || view !== "theme") return;

        const action = entry?.action;
        if (action?.type !== "theme" || action.preference === themePreference) return;

        setThemePreference(action.preference);
      }}
      onEscape={(ctx) => {
        const escapeAction = resolveCommandPaletteEscapeAction(ctx.query, view);

        if (escapeAction === "clear") {
          ctx.setQuery("");
          ctx.setActiveIndex(0);
          return true;
        }

        if (escapeAction === "exit-view") {
          exitThemePreview();
          return true;
        }

        closePalette();
        return true;
      }}
      onClose={closePalette}
    />
  );
};
