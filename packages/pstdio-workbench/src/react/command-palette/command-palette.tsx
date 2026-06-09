import { Box } from "@chakra-ui/react";
import { Palette, type PaletteEntry, PaletteShortcut, type ThemePreference, useThemePreference } from "@pstdio/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type Command,
  type KeybindingSequence,
  type MenuPath,
  type RegisteredCommand,
  type RegisteredMenuItem,
  type WorkbenchCommandExecutionContext,
  type WorkbenchCore,
  workbenchCommandPaletteMenuPath,
} from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchCommandPaletteBackground } from "../theme/workbench-theme-background";
import { hasCommandParameters } from "./command-palette-params";
import { useWorkbenchCommandPaletteResourceEntries } from "./command-palette-resources";
import {
  type CommandParamFieldRenderer,
  CommandParamsDialog,
  type CommandParamsRequest,
} from "./command-params-dialog";
import { createWorkbenchModePaletteEntries, getModeEntryIndex } from "./mode-palette";
import {
  COMMAND_MODE_ID,
  getPaletteInitialActiveIndex,
  getPaletteInputIcon,
  getPalettePlaceholder,
  getPaletteViewMode,
  getPaletteViewModes,
  isPickerPaletteView,
  isThemePaletteView,
} from "./palette-view";
import { createWorkbenchResourcePaletteEntries } from "./resource-palette";
import {
  createWorkbenchThemePreferencePaletteEntries,
  getThemePreferenceEntryIndex,
  type WorkbenchThemePaletteEntry,
} from "./theme-palette";

export type { WorkbenchResourcePaletteEntry } from "./resource-palette";
export { createWorkbenchResourcePaletteEntries };

interface WorkbenchCommandPaletteProps {
  workbench: WorkbenchCore;
  open: boolean;
  menuPath?: MenuPath;
  initialQuery?: string;
  renderParamField?: CommandParamFieldRenderer;
  onClose: () => void;
}

export interface WorkbenchCommandPaletteEntry extends PaletteEntry {
  commandId: string;
  mode: typeof COMMAND_MODE_ID;
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
  [label, command.id, command.description, command.category].filter(Boolean).join(" ");

const createShortcutByCommandId = (workbench: WorkbenchCore) =>
  new Map(
    workbench.keybindings.listActiveKeybindings().map((keybinding) => [keybinding.commandId, keybinding.keybinding]),
  );

const getShortcut = (binding: KeybindingSequence | undefined): ReactNode =>
  binding ? <PaletteShortcut binding={binding} /> : undefined;

const getCommandErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Command failed.");

const commandExecutionContext = (workbench: WorkbenchCore): WorkbenchCommandExecutionContext | undefined => {
  const resource = workbench.getPrimaryResource();
  return resource ? { resource } : undefined;
};

const executePaletteCommand = async (input: {
  workbench: WorkbenchCore;
  commandId: string;
  args: unknown;
  context?: WorkbenchCommandExecutionContext;
  label: string;
}) => {
  const { args, commandId, context, label, workbench } = input;
  try {
    await workbench.commands.executeCommand(commandId, args, context);
  } catch (error) {
    workbench.notifications.show({ level: "error", title: `${label} failed`, message: getCommandErrorMessage(error) });
  }
};

const createEntry = (input: {
  workbench: WorkbenchCore;
  record: RegisteredCommand;
  action?: RegisteredMenuItem;
  shortcutByCommandId: Map<string, KeybindingSequence>;
  onClose: () => void;
  onRequestParams?: (request: CommandParamsRequest) => void;
}): WorkbenchCommandPaletteEntry | null => {
  const { action, onClose, onRequestParams, record, workbench, shortcutByCommandId } = input;
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
      const context = commandExecutionContext(workbench);
      onClose();
      if (hasCommandParameters(record.command.params) && onRequestParams) {
        onRequestParams({ record, action, label, args, context });
        return;
      }
      void executePaletteCommand({ workbench, commandId: record.command.id, args, context, label });
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
  onRequestParams?: (request: CommandParamsRequest) => void;
}) => {
  const { menuPath, onClose, onRequestParams, workbench } = input;
  const shortcutByCommandId = createShortcutByCommandId(workbench);

  return listCommandRecords(workbench, menuPath)
    .sort(byCommandPaletteGroup)
    .map(({ record, action }) =>
      createEntry({ workbench, record, action, shortcutByCommandId, onClose, onRequestParams }),
    )
    .filter((entry): entry is WorkbenchCommandPaletteEntry => entry !== null);
};

export const WorkbenchCommandPalette = (props: WorkbenchCommandPaletteProps) => {
  const {
    workbench,
    open,
    menuPath = workbenchCommandPaletteMenuPath,
    initialQuery = "",
    renderParamField,
    onClose,
  } = props;
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  const view = useWorkbenchStore(workbench.commandPalette.store, (state) => state.view);
  const themePreviewRef = useRef<WorkbenchThemePreviewState | null>(null);
  const paramsRequest = useWorkbenchStore(workbench.commandPalette.store, (state) => state.paramsRequest);
  const [liveQuery, setLiveQuery] = useState(initialQuery);
  const commandPaletteResourceEntries = useWorkbenchCommandPaletteResourceEntries({
    workbench,
    query: liveQuery,
    open,
    onClose,
  });

  const closePalette = () => {
    rollbackThemePreview(setThemePreference, themePreviewRef);
    onClose();
  };

  const exitPickerView = () => {
    rollbackThemePreview(setThemePreference, themePreviewRef);
    workbench.commandPalette.open({ view: "main" });
  };

  const commitThemePreview = () => {
    themePreviewRef.current = null;
    onClose();
  };

  const commandEntries = createWorkbenchCommandPaletteEntries({
    workbench,
    menuPath,
    onClose,
    onRequestParams: (request) => workbench.commandPalette.requestParams(request),
  });
  const resourceEntries = createWorkbenchResourcePaletteEntries({ workbench, query: initialQuery, onClose });
  const themeEntries = createWorkbenchThemePreferencePaletteEntries({
    themePreference,
    themePreferences,
    setThemePreference,
    onClose: commitThemePreview,
  });
  const modeEntries = createWorkbenchModePaletteEntries({ workbench, onClose });
  const entries = [
    ...resourceEntries,
    ...commandPaletteResourceEntries,
    ...commandEntries,
    ...themeEntries,
    ...modeEntries,
  ];
  const themeInitialActiveIndex = getThemePreferenceEntryIndex(themePreference, themePreferences);
  const modeInitialActiveIndex = getModeEntryIndex(workbench.modes.getActiveModeId(), workbench.modes.listModes());
  const isThemeView = isThemePaletteView(view);
  const initialActiveIndex = getPaletteInitialActiveIndex({
    view,
    themeInitialActiveIndex,
    modeInitialActiveIndex,
  });
  const activeViewMode = getPaletteViewMode(view);
  const activeViewModes = getPaletteViewModes(view);

  useEffect(() => {
    if (open) setLiveQuery(initialQuery);
  }, [initialQuery, open]);

  useEffect(() => {
    if (open && isThemeView) {
      if (!themePreviewRef.current) themePreviewRef.current = { baseTheme: themePreference };
      return;
    }

    rollbackThemePreview(setThemePreference, themePreviewRef);
  }, [isThemeView, open, setThemePreference, themePreference]);

  return (
    <>
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
          initialActiveIndex={initialActiveIndex}
          mode={activeViewMode}
          modes={activeViewModes}
          resetKey={`${view}:${initialQuery}`}
          inputIcon={({ mode }) => getPaletteInputIcon({ view, mode })}
          placeholder={({ mode }) => getPalettePlaceholder({ view, mode })}
          emptyLabel="No results found."
          onActiveEntryChange={(entry) => {
            if (!open || !isThemeView) return;
            const themeEntry = entry as WorkbenchThemePaletteEntry | null;
            if (!themeEntry?.themePreference || themeEntry.themePreference === themePreference) return;
            setThemePreference(themeEntry.themePreference);
          }}
          onQueryChange={setLiveQuery}
          onClose={closePalette}
          onEscape={(ctx) => {
            if (isPickerPaletteView(view)) {
              exitPickerView();
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
      <CommandParamsDialog
        request={paramsRequest}
        renderParamField={renderParamField}
        onClose={() => workbench.commandPalette.clearParams()}
        onRun={(input) => executePaletteCommand({ workbench, ...input })}
      />
    </>
  );
};
