import { Palette, type PaletteEntry, type PaletteMode, PaletteShortcut } from "@pstdio/ui";
import { Search, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import {
  type Command,
  type MenuPath,
  type RegisteredCommand,
  type RegisteredMenuAction,
  type ResourceBrowseEntry,
  type WorkbenchCore,
  workbenchCommandPaletteMenuPath,
} from "../../core";
import { WorkbenchIcon } from "../shared/icon";

const SEARCH_MODE_ID = "search";
const COMMAND_MODE_ID = "command";

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
}

export interface WorkbenchResourcePaletteEntry extends PaletteEntry {
  resourceUri: string;
}

interface WorkbenchCommandPaletteRecord {
  record: RegisteredCommand;
  action?: RegisteredMenuAction;
}

const getCommandSearchText = (command: Command, label: string) =>
  [label, command.description, command.category].filter(Boolean).join(" ");

const createShortcutByCommandId = (workbench: WorkbenchCore) =>
  new Map(
    workbench.keybindings.listActiveKeybindings().map((keybinding) => [keybinding.commandId, keybinding.keybinding]),
  );

const getShortcut = (binding: string | undefined): ReactNode =>
  binding ? <PaletteShortcut binding={binding} /> : undefined;

const createEntry = (input: {
  workbench: WorkbenchCore;
  record: RegisteredCommand;
  action?: RegisteredMenuAction;
  shortcutByCommandId: Map<string, string>;
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

  return workbench.menus
    .listMenuActions(menuPath)
    .filter((action) => workbench.context.matches(action.when))
    .map((action) => {
      const record = workbench.commands.getCommand(action.commandId);
      return record ? { record, action } : null;
    })
    .filter((item): item is { record: RegisteredCommand; action: RegisteredMenuAction } => item !== null);
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
  const commandEntries = createWorkbenchCommandPaletteEntries({ workbench, menuPath, onClose });
  const resourceEntries = createWorkbenchResourcePaletteEntries({ workbench, query: initialQuery, onClose });
  const entries = [...resourceEntries, ...commandEntries];

  return (
    <Palette
      open={open}
      entries={entries}
      initialQuery={initialQuery}
      modes={workbenchPaletteModes}
      inputIcon={({ mode }) =>
        mode === COMMAND_MODE_ID ? <Terminal size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />
      }
      placeholder={({ mode }) => (mode === COMMAND_MODE_ID ? "Run command" : "Search resources")}
      emptyLabel="No results found."
      onClose={onClose}
    />
  );
};
