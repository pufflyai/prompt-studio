import { Box } from "@chakra-ui/react";
import {
  Palette,
  type PaletteEntry,
  type PaletteMode,
  PaletteShortcut,
  type ThemePreference,
  useThemePreference,
} from "@pstdio/ui";
import { Search, Terminal } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import {
  type Command,
  type KeybindingSequence,
  type MenuPath,
  type RegisteredCommand,
  type RegisteredMenuItem,
  type ResourceBrowseEntry,
  type WorkbenchCore,
  workbenchCommandPaletteMenuPath,
} from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchCommandPaletteBackground } from "../theme/workbench-theme-background";
import {
  createWorkbenchThemePreferencePaletteEntries,
  getThemePreferenceEntryIndex,
  type WorkbenchThemePaletteEntry,
} from "./theme-palette";

const SEARCH_MODE_ID = "search";
const COMMAND_MODE_ID = "command";
const THEME_MODE_ID = "theme";

const workbenchPaletteModes: PaletteMode[] = [{ id: SEARCH_MODE_ID }, { id: COMMAND_MODE_ID, inputPrefix: ">" }];

interface WorkbenchCommandPaletteProps {
  workbench: WorkbenchCore;
  open: boolean;
  menuPath?: MenuPath;
  initialQuery?: string;
  onClose: () => void;
}

export interface WorkbenchCommandPaletteEntry extends PaletteEntry {
  commandId: string;
  mode: typeof COMMAND_MODE_ID;
}

export interface WorkbenchResourcePaletteEntry extends PaletteEntry {
  resourceUri: string;
  mode: typeof SEARCH_MODE_ID;
}

interface WorkbenchThemePreviewState {
  baseTheme: ThemePreference;
}

interface WorkbenchCommandPaletteRecord {
  record: RegisteredCommand;
  action?: RegisteredMenuItem;
}

const rollbackThemePreview = (
  setThemePreference: (themePreference: ThemePreference) => void,
  themePreviewRef: { current: WorkbenchThemePreviewState | null },
) => {
  const preview = themePreviewRef.current;
  themePreviewRef.current = null;
  if (preview) setThemePreference(preview.baseTheme);
};

const getCommandSearchText = (command: Command, label: string) =>
  [label, command.description, command.category].filter(Boolean).join(" ");

const createShortcutByCommandId = (workbench: WorkbenchCore) =>
  new Map(
    workbench.keybindings.listActiveKeybindings().map((keybinding) => [keybinding.commandId, keybinding.keybinding]),
  );

const getShortcut = (binding: KeybindingSequence | undefined): ReactNode =>
  binding ? <PaletteShortcut binding={binding} /> : undefined;

const createEntry = (input: {
  workbench: WorkbenchCore;
  record: RegisteredCommand;
  action?: RegisteredMenuItem;
  shortcutByCommandId: Map<string, KeybindingSequence>;
  onClose: () => void;
}): WorkbenchCommandPaletteEntry | null => {
  const { action, onClose, record, workbench, shortcutByCommandId } = input;
  const args = action?.args;

  if (!workbench.commands.isCommandVisible(record.command.id, args)) return null;

  const label = action?.label ?? record.command.label;
  const icon = action?.icon ?? record.command.icon;
  const group = action?.group ?? record.command.category;

  return {
    id: `workbench-command:${record.command.id}`,
    commandId: record.command.id,
    mode: COMMAND_MODE_ID,
    label,
    searchText: getCommandSearchText(record.command, label),
    description: record.command.description,
    group,
    icon: icon ? <WorkbenchIcon name={icon} /> : undefined,
    shortcut: getShortcut(shortcutByCommandId.get(record.command.id)),
    onActivate: () => {
      onClose();
      void workbench.commands.executeCommand(record.command.id, args).catch(() => undefined);
    },
  };
};

const createResourceEntry = (input: {
  workbench: WorkbenchCore;
  entry: ResourceBrowseEntry;
  onClose: () => void;
}): WorkbenchResourcePaletteEntry => {
  const { entry, onClose, workbench } = input;
  const { resource } = entry;
  const label = entry.resource.label ?? entry.resource.uri;
  const icon = resource.icon ?? workbench.resources.getKind(resource.kind)?.icon;

  return {
    id: `workbench-resource:${resource.uri}`,
    resourceUri: resource.uri,
    mode: SEARCH_MODE_ID,
    label,
    searchText: entry.searchText ?? label,
    description: entry.description,
    group: entry.group,
    icon: icon ? <WorkbenchIcon name={icon} /> : undefined,
    onActivate: () => {
      onClose();
      void workbench.resources.openResource(resource).catch(() => undefined);
    },
  };
};

const getRecordGroup = (item: WorkbenchCommandPaletteRecord) =>
  item.action?.group ?? item.record.command.category ?? "";

const getRecordOrder = (item: WorkbenchCommandPaletteRecord) => item.action?.order ?? 0;

const byCommandPaletteGroup = (left: WorkbenchCommandPaletteRecord, right: WorkbenchCommandPaletteRecord) => {
  const groupComparison = getRecordGroup(left).localeCompare(getRecordGroup(right));
  if (groupComparison !== 0) return groupComparison;

  return getRecordOrder(left) - getRecordOrder(right);
};

const listCommandRecords = (workbench: WorkbenchCore, menuPath?: MenuPath) => {
  if (!menuPath) {
    return workbench.commands.listCommands().map((record) => ({ record, action: undefined }));
  }

  return workbench.layout
    .listMenuItems(menuPath)
    .filter((action) => workbench.context.matches(action.when))
    .map((action) => {
      const record = workbench.commands.getCommand(action.commandId);
      return record ? { record, action } : null;
    })
    .filter((item): item is { record: RegisteredCommand; action: RegisteredMenuItem } => item !== null);
};

export const createWorkbenchCommandPaletteEntries = (input: {
  workbench: WorkbenchCore;
  menuPath?: MenuPath;
  onClose: () => void;
}) => {
  const { menuPath, onClose, workbench } = input;
  const shortcutByCommandId = createShortcutByCommandId(workbench);

  return listCommandRecords(workbench, menuPath)
    .sort(byCommandPaletteGroup)
    .map(({ record, action }) => createEntry({ workbench, record, action, shortcutByCommandId, onClose }))
    .filter((entry): entry is WorkbenchCommandPaletteEntry => entry !== null);
};

export const createWorkbenchResourcePaletteEntries = (input: {
  workbench: WorkbenchCore;
  query: string;
  onClose: () => void;
}) => {
  const { onClose, query, workbench } = input;
  return workbench.resources.listResources(query).map((entry) => createResourceEntry({ workbench, entry, onClose }));
};

export const WorkbenchCommandPalette = (props: WorkbenchCommandPaletteProps) => {
  const { workbench, open, menuPath = workbenchCommandPaletteMenuPath, initialQuery = "", onClose } = props;
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  const view = useWorkbenchStore(workbench.commandPalette.store, (state) => state.view);
  const themePreviewRef = useRef<WorkbenchThemePreviewState | null>(null);

  const closePalette = () => {
    rollbackThemePreview(setThemePreference, themePreviewRef);
    onClose();
  };

  const exitThemeView = () => {
    rollbackThemePreview(setThemePreference, themePreviewRef);
    workbench.commandPalette.open({ view: "main" });
  };

  const commitThemePreview = () => {
    themePreviewRef.current = null;
    onClose();
  };

  const commandEntries = createWorkbenchCommandPaletteEntries({ workbench, menuPath, onClose });
  const resourceEntries = createWorkbenchResourcePaletteEntries({ workbench, query: initialQuery, onClose });
  const themeEntries = createWorkbenchThemePreferencePaletteEntries({
    themePreference,
    themePreferences,
    setThemePreference,
    onClose: commitThemePreview,
  });
  const entries = [...resourceEntries, ...commandEntries, ...themeEntries];
  const themeInitialActiveIndex = getThemePreferenceEntryIndex(themePreference, themePreferences);

  useEffect(() => {
    if (open && view === "theme") {
      if (!themePreviewRef.current) themePreviewRef.current = { baseTheme: themePreference };
      return;
    }

    rollbackThemePreview(setThemePreference, themePreviewRef);
  }, [open, setThemePreference, themePreference, view]);

  return (
    <Box
      display="contents"
      css={{
        "& [data-scope=dialog][data-part=backdrop], & [data-scope=dialog][data-part=positioner]": {
          position: "absolute",
          inset: "0",
        },
        "& [data-scope=dialog][data-part=positioner]": {
          h: "full",
          minH: "0",
          paddingInline: "md",
          paddingTop: "xl",
          w: "full",
        },
        "& [data-scope=dialog][data-part=content]": { background: workbenchCommandPaletteBackground },
      }}
    >
      <Palette
        open={open}
        entries={entries}
        initialQuery={initialQuery}
        initialActiveIndex={view === "theme" ? themeInitialActiveIndex : 0}
        mode={view === "theme" ? THEME_MODE_ID : undefined}
        modes={view === "theme" ? undefined : workbenchPaletteModes}
        resetKey={`${view}:${initialQuery}`}
        inputIcon={({ mode }) =>
          view === "theme" ? (
            <WorkbenchIcon name="Palette" size={16} />
          ) : mode === COMMAND_MODE_ID ? (
            <Terminal size={16} aria-hidden="true" />
          ) : (
            <Search size={16} aria-hidden="true" />
          )
        }
        placeholder={({ mode }) =>
          view === "theme" ? "Search themes" : mode === COMMAND_MODE_ID ? "Run command" : "Search resources"
        }
        emptyLabel="No results found."
        onActiveEntryChange={(entry) => {
          if (!open || view !== "theme") return;
          const themeEntry = entry as WorkbenchThemePaletteEntry | null;
          if (!themeEntry?.themePreference || themeEntry.themePreference === themePreference) return;
          setThemePreference(themeEntry.themePreference);
        }}
        onClose={closePalette}
        onEscape={(ctx) => {
          if (view === "theme") {
            exitThemeView();
            return true;
          }

          if (ctx.query.length > 0) {
            ctx.setQuery("");
            ctx.setActiveIndex(0);
            return true;
          }

          closePalette();
          return true;
        }}
      />
    </Box>
  );
};
