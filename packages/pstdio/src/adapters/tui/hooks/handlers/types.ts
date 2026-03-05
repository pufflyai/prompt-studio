import type { Mode, Tab } from "../../app";
import type { SettingsSection } from "../use-settings";
import type { useTemplates } from "../use-templates";
import type { useTickets } from "../use-tickets";

export const TABS: Tab[] = ["tickets", "docs", "templates"];

export interface KeyboardDeps {
  mode: Mode;
  setMode: (mode: Mode | ((m: Mode) => Mode)) => void;
  exit: () => void;
  // docs
  docsSelectedIndex: number;
  docsRowCount: number;
  docsMoveTo: (index: number) => void;
  docsResetSelection: () => void;
  toggleExpand: () => void;
  openDocument: () => void;
  setInputValue: (value: string) => void;
  setSearchQuery: (query: string) => void;
  // tickets
  ticketSelectedIndex: number;
  ticketRowCount: number;
  ticketMoveTo: (index: number) => void;
  ticketResetSelection: () => void;
  ticketState: ReturnType<typeof useTickets>;
  // templates
  templateSelectedIndex: number;
  templateRowCount: number;
  templateMoveTo: (index: number) => void;
  templateState: ReturnType<typeof useTemplates>;
  // project picker
  pickerCount: number;
  setPickerIndex: (fn: (i: number) => number) => void;
  onPickerSelect: () => void;
  onPickerOpen: () => void;
  // agent manager
  agentCount: number;
  setAgentIndex: (fn: (i: number) => number) => void;
  onAgentOpen: () => void;
  onAgentSetup: () => void;
  onAgentRemove: () => void;
  onAgentSetDefault: () => void;
  // status picker
  statusPickerCount: number;
  statusPickerIndex: number;
  setStatusPickerIndex: (fn: (i: number) => number) => void;
  // archive confirmation
  onArchiveRequest: (ticket: { id: string; title: string | null }) => void;
  onArchiveConfirm: () => void;
  // settings overlay
  settingsSection: SettingsSection;
  settingsItemCount: number;
  settingsIndex: number;
  setSettingsIndex: (fn: (i: number) => number) => void;
  settingsColorPicker: boolean;
  settingsColorIndex: number;
  setSettingsColorIndex: (fn: (i: number) => number) => void;
  settingsCreateStep: "idle" | "name" | "color";
  onSettingsOpen: () => void;
  onSettingsSwitchSection: () => void;
  onSettingsStartCreate: () => void;
  onSettingsCancelCreate: () => void;
  onSettingsColorConfirm: (color: string) => void;
  onSettingsOpenColorPicker: () => void;
  onSettingsCloseColorPicker: () => void;
  onSettingsSetDefault: () => void;
  onSettingsDelete: () => void;
  onSettingsNameSubmit: (name: string) => void;
}

export type InputKey = {
  escape: boolean;
  downArrow: boolean;
  upArrow: boolean;
  return: boolean;
  tab: boolean;
  shift: boolean;
};

export const closeOverlay = (deps: KeyboardDeps) => deps.setMode((m) => ({ ...m, overlay: undefined }));
