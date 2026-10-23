import { Palette, type PaletteEntry, PaletteShortcut, useThemePreference } from "@pstdio/ui";
import { type ReactNode, useEffect, useState } from "react";
import {
  type Command,
  getNavigationTargetKey,
  type KeybindingSequence,
  type MenuPath,
  type RegisteredCommand,
  type RegisteredMenuItem,
  type WorkbenchCommandExecutionContext,
  type WorkbenchCore,
  workbenchCommandPaletteMenuPath,
} from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";
import { useShortcutCatalog } from "../keybindings/use-shortcut-catalog";
import { WorkbenchActionErrors } from "../notifications/action-errors";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { hasCommandParameters } from "./command-palette-params";
import { useWorkbenchCommandPaletteResourceEntries } from "./command-palette-resources";
import type { CommandParamFieldRenderer, CommandParamsRequest } from "./command-params-dialog";
import { PaletteParamsDialog } from "./palette-params-dialog";
import { WorkbenchPaletteSurface } from "./palette-surface";
import {
  COMMAND_MODE_ID,
  getPaletteInitialActiveIndex,
  getPaletteInputIcon,
  getPalettePlaceholder,
  getPaletteViewMode,
  getPaletteViewModes,
  isThemePaletteView,
} from "./palette-view";
import { createWorkbenchPanelWidgetPaletteEntries } from "./panel-widget-palette";
import { createWorkbenchResourcePaletteEntries } from "./resource-palette";
import { WorkbenchResourceSearch } from "./resource-search";
import {
  createWorkbenchThemePreferencePaletteEntries,
  getThemePaletteEntryIndex,
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

interface WorkbenchCommandPaletteRecord {
  record: RegisteredCommand;
  action?: RegisteredMenuItem;
}

const getCommandSearchText = (command: Command, label: string) =>
  [label, command.id, command.description, command.category].filter(Boolean).join(" ");

const createShortcutByAction = (workbench: WorkbenchCore) => workbench.keyboard.hints();

const getShortcut = (binding: KeybindingSequence | undefined): ReactNode =>
  binding ? <PaletteShortcut binding={binding} /> : undefined;

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
  onClose: () => void;
}) => {
  const { args, commandId, context, label, workbench, onClose } = input;
  const closePalette = workbench.commandPalette.captureClose(onClose);
  await runUserAction(workbench, label, () => workbench.commands.executeCommand(commandId, args, context), {
    inlineTarget: "command-palette",
    onSuccess: closePalette,
  });
};

const createEntry = (input: {
  workbench: WorkbenchCore;
  record: RegisteredCommand;
  action?: RegisteredMenuItem;
  shortcutByAction: Map<string, KeybindingSequence>;
  onClose: () => void;
  onRequestParams?: (request: CommandParamsRequest) => void;
}): WorkbenchCommandPaletteEntry | null => {
  const { action, onClose, onRequestParams, record, workbench, shortcutByAction } = input;
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
    shortcut: getShortcut(
      shortcutByAction.get(getNavigationTargetKey({ kind: "command", commandId: record.command.id, args })) ??
        shortcutByAction.get(
          getNavigationTargetKey({
            kind: "command",
            commandId: action?.sourceCommandId ?? record.command.id,
            args,
          }),
        ),
    ),
    onActivate: () => {
      const context = commandExecutionContext(workbench);
      if (hasCommandParameters(record.command.params) && onRequestParams) {
        onClose();
        onRequestParams({ record, action, label, args, context });
        return;
      }
      void executePaletteCommand({ workbench, commandId: record.command.id, args, context, label, onClose });
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
  shortcutByAction?: Map<string, KeybindingSequence>;
}) => {
  const { menuPath, onClose, onRequestParams, workbench } = input;
  const shortcutByAction = input.shortcutByAction ?? createShortcutByAction(workbench);

  return listCommandRecords(workbench, menuPath)
    .sort(byCommandPaletteGroup)
    .map(({ record, action }) => createEntry({ workbench, record, action, shortcutByAction, onClose, onRequestParams }))
    .filter((entry): entry is WorkbenchCommandPaletteEntry => entry !== null);
};

export const WorkbenchCommandPalette = (props: WorkbenchCommandPaletteProps) => {
  const { workbench, open, onClose } = props;
  const request = useWorkbenchStore(workbench.commandPalette.store, (state) => state.resourceSearch);
  if (request && open) return <WorkbenchResourceSearch workbench={workbench} request={request} onClose={onClose} />;
  return <WorkbenchMainCommandPalette {...props} />;
};

const WorkbenchMainCommandPalette = (props: WorkbenchCommandPaletteProps) => {
  const {
    workbench,
    open,
    menuPath = workbenchCommandPaletteMenuPath,
    initialQuery = "",
    renderParamField,
    onClose,
  } = props;
  const { chosenThemePreference, themePreferences, setThemePreference, previewThemePreference } = useThemePreference();
  const view = useWorkbenchStore(workbench.commandPalette.store, (state) => state.view);
  const { hints } = useShortcutCatalog(workbench);
  const requestId = useWorkbenchStore(workbench.commandPalette.store, (state) => state.requestId);
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const [liveQuery, setLiveQuery] = useState(initialQuery);
  const commandPaletteResourceEntries = useWorkbenchCommandPaletteResourceEntries({
    workbench,
    query: liveQuery,
    open,
    onClose,
  });
  const compositionPanels = useWorkbenchCompositionPanels(workbench);

  // A theme preview is never saved, so leaving the picker in any way shows the chosen theme again.
  const closePalette = () => {
    previewThemePreference(null);
    onClose();
  };

  const exitPickerView = () => {
    previewThemePreference(null);
    workbench.commandPalette.open({ view: "main" });
  };

  const commandEntries = createWorkbenchCommandPaletteEntries({
    workbench,
    menuPath,
    onClose,
    shortcutByAction: hints,
    onRequestParams: (request) => workbench.commandPalette.requestParams(request),
  });
  const resourceEntries = createWorkbenchResourcePaletteEntries({ workbench, query: initialQuery, onClose });
  const themeEntries = createWorkbenchThemePreferencePaletteEntries({
    chosenThemePreference,
    themePreferences,
    setThemePreference,
    onClose,
  });
  const panelWidgetEntries = createWorkbenchPanelWidgetPaletteEntries({
    workbench,
    onClose,
    panelsByRegion: compositionPanels,
  });
  const entries = [
    ...resourceEntries,
    ...commandPaletteResourceEntries,
    ...commandEntries,
    ...panelWidgetEntries,
    ...themeEntries,
  ];
  const themeInitialActiveIndex = getThemePaletteEntryIndex(themeEntries, chosenThemePreference);
  const isThemeView = isThemePaletteView(view);
  const initialActiveIndex = getPaletteInitialActiveIndex({
    view,
    themeInitialActiveIndex,
  });
  const activeViewMode = getPaletteViewMode(view);
  const activeViewModes = getPaletteViewModes(view);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new presentation resets provider queries even when its initial text is unchanged.
  useEffect(() => {
    if (open) setLiveQuery(initialQuery);
  }, [initialQuery, open, requestId]);

  useEffect(() => {
    if (!open || !isThemeView) previewThemePreference(null);
  }, [isThemeView, open, previewThemePreference]);

  return (
    <>
      <WorkbenchPaletteSurface>
        <Palette
          open={open}
          entries={entries}
          initialQuery={initialQuery}
          initialActiveIndex={initialActiveIndex}
          mode={activeViewMode}
          modes={activeViewModes}
          resetKey={`${requestId}:${view}:${initialQuery}`}
          inputIcon={({ mode }) => getPaletteInputIcon({ view, mode })}
          placeholder={({ mode }) => getPalettePlaceholder({ view, mode })}
          emptyLabel="No results found."
          footerStart={<WorkbenchActionErrors workbench={workbench} target="command-palette" />}
          onActiveEntryChange={(entry) => {
            if (!open || !isThemeView) return;
            const themeEntry = entry as WorkbenchThemePaletteEntry | null;
            if (!themeEntry?.themePreference) return;
            previewThemePreference(
              themeEntry.themePreference === chosenThemePreference ? null : themeEntry.themePreference,
            );
          }}
          onQueryChange={setLiveQuery}
          onClose={closePalette}
          onEscape={(ctx) => {
            if (isThemePaletteView(view)) {
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
      </WorkbenchPaletteSurface>
      <PaletteParamsDialog workbench={workbench} renderParamField={renderParamField} />
    </>
  );
};
