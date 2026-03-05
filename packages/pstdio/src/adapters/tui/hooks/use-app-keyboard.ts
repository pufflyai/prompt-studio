import type React from "react";
import { useState } from "react";

import type { DocRow } from "@/features/docs/types";

import type { Mode } from "../app";
import type { useAgents } from "./use-agents";
import type { useDocs } from "./use-docs";
import { useKeyboard } from "./use-keyboard";
import type { useProject } from "./use-project";
import type { useSelection } from "./use-selection";
import type { SettingsSection, useSettings } from "./use-settings";
import type { useTemplates } from "./use-templates";
import type { useTickets } from "./use-tickets";

interface AppKeyboardArgs {
  mode: Mode;
  setMode: (mode: Mode | ((m: Mode) => Mode)) => void;
  exit: () => void;
  docs: ReturnType<typeof useDocs>;
  docsSelection: ReturnType<typeof useSelection>;
  docsRows: DocRow[];
  selectedRow: DocRow | undefined;
  ticketState: ReturnType<typeof useTickets>;
  ticketSelection: ReturnType<typeof useSelection>;
  templateState: ReturnType<typeof useTemplates>;
  templateSelection: ReturnType<typeof useSelection>;
  projectState: ReturnType<typeof useProject>;
  agentState: ReturnType<typeof useAgents>;
  settingsState: ReturnType<typeof useSettings>;
  setInputValue: (value: string) => void;
  setSearchQuery: (query: string) => void;
  setViewContent: (content: { title: string; content: string }) => void;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useAppKeyboard(args: AppKeyboardArgs) {
  const [pickerIndex, setPickerIndex] = useState(0);
  const [agentIndex, setAgentIndex] = useState(0);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string | null } | null>(null);

  // Settings overlay state
  const [settingsIndex, setSettingsIndex] = useState(0);
  const [settingsColorIndex, setSettingsColorIndex] = useState(0);
  const [settingsColorPicker, setSettingsColorPicker] = useState(false);
  const [settingsCreateStep, setSettingsCreateStep] = useState<"idle" | "name" | "color">("idle");
  const [settingsCreateName, setSettingsCreateName] = useState("");

  const settingsItems = () =>
    args.settingsState.section === "statuses" ? args.settingsState.statuses : args.settingsState.tags;

  const toggleExpand = () => {
    const { selectedRow } = args;
    if (!selectedRow) return;

    if (selectedRow.hasChildren) {
      args.setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(selectedRow.item.text)) {
          next.delete(selectedRow.item.text);
        } else {
          next.add(selectedRow.item.text);
        }
        return next;
      });
      return;
    }

    if (selectedRow.item.link) {
      const content = args.docs.getDocument(selectedRow.item.link);
      args.setViewContent({ title: selectedRow.item.text, content: content ?? "" });
      args.setMode((m) => ({ ...m, overlay: "view" }));
    }
  };

  useKeyboard({
    mode: args.mode,
    setMode: args.setMode,
    exit: args.exit,
    // docs
    docsSelectedIndex: args.docsSelection.selectedIndex,
    docsRowCount: args.docsRows.length,
    docsMoveTo: args.docsSelection.moveTo,
    docsResetSelection: args.docsSelection.resetSelection,
    toggleExpand,
    openDocument: () => {
      if (!args.selectedRow?.item.link) return;
      const content = args.docs.getDocument(args.selectedRow.item.link);
      args.setViewContent({ title: args.selectedRow.item.text, content: content ?? "" });
      args.setMode((m) => ({ ...m, overlay: "view" }));
    },
    setInputValue: args.setInputValue,
    setSearchQuery: args.setSearchQuery,
    // tickets
    ticketSelectedIndex: args.ticketSelection.selectedIndex,
    ticketRowCount: args.ticketState.flatRows.length,
    ticketMoveTo: args.ticketSelection.moveTo,
    ticketResetSelection: args.ticketSelection.resetSelection,
    ticketState: args.ticketState,
    // templates
    templateSelectedIndex: args.templateSelection.selectedIndex,
    templateRowCount: args.templateState.items.length,
    templateMoveTo: args.templateSelection.moveTo,
    templateState: args.templateState,
    // project picker
    pickerCount: args.projectState.projects.length,
    setPickerIndex,
    onPickerSelect: () => {
      const selected = args.projectState.projects[pickerIndex];
      if (selected) args.projectState.switchProject(selected.id);
    },
    onPickerOpen: () => {
      setPickerIndex(0);
      args.projectState.loadProjects();
    },
    // agent manager
    agentCount: args.agentState.agents.length,
    setAgentIndex,
    onAgentOpen: () => {
      setAgentIndex(0);
      args.agentState.loadAgents();
    },
    onAgentSetup: () => {
      const selected = args.agentState.agents[agentIndex];
      if (selected?.configured === false) args.agentState.setup(selected.agentId);
    },
    onAgentRemove: () => {
      const selected = args.agentState.agents[agentIndex];
      if (selected?.configured) args.agentState.remove(selected.agentId);
    },
    onAgentSetDefault: () => {
      const selected = args.agentState.agents[agentIndex];
      if (selected?.configured) args.agentState.setDefault(selected.agentId);
    },
    // status picker
    statusPickerCount: args.ticketState.statuses.length,
    statusPickerIndex: pickerIndex,
    setStatusPickerIndex: setPickerIndex,
    onArchiveRequest: setArchiveTarget,
    onArchiveConfirm: () => {
      if (archiveTarget)
        args.ticketState.toggleArchive(archiveTarget as Parameters<typeof args.ticketState.toggleArchive>[0]);
      setArchiveTarget(null);
    },
    // settings
    settingsSection: args.settingsState.section,
    settingsItemCount: settingsItems().length,
    settingsIndex,
    setSettingsIndex,
    settingsColorPicker,
    settingsColorIndex,
    setSettingsColorIndex,
    settingsCreateStep,
    onSettingsOpen: () => {
      setSettingsIndex(0);
      setSettingsColorPicker(false);
      setSettingsCreateStep("idle");
    },
    onSettingsSwitchSection: () => {
      const next: SettingsSection = args.settingsState.section === "statuses" ? "tags" : "statuses";
      args.settingsState.setSection(next);
      setSettingsIndex(0);
      setSettingsColorPicker(false);
      setSettingsCreateStep("idle");
    },
    onSettingsStartCreate: () => {
      setSettingsCreateStep("name");
      setSettingsCreateName("");
      args.setInputValue("");
      args.setMode((m) => ({ ...m, search: true }));
    },
    onSettingsCancelCreate: () => {
      setSettingsCreateStep("idle");
      setSettingsCreateName("");
      args.setInputValue("");
      args.setMode((m) => ({ ...m, search: undefined }));
    },
    onSettingsColorConfirm: (color: string) => {
      if (settingsCreateStep === "color") {
        // Finishing a create flow
        const section = args.settingsState.section;
        if (section === "statuses") {
          args.settingsState.addStatus(settingsCreateName, color);
        } else {
          args.settingsState.addTag(settingsCreateName, color);
        }
        setSettingsCreateStep("idle");
        setSettingsCreateName("");
        setSettingsColorIndex(0);
      } else {
        const items = settingsItems();
        const item = items[settingsIndex];
        if (item) {
          const section = args.settingsState.section;
          if (section === "statuses") {
            args.settingsState.changeStatusColor(item.id, color);
          } else {
            args.settingsState.changeTagColor(item.id, color);
          }
        }
        setSettingsColorPicker(false);
        setSettingsColorIndex(0);
      }
    },
    onSettingsOpenColorPicker: () => {
      setSettingsColorPicker(true);
      setSettingsColorIndex(0);
    },
    onSettingsCloseColorPicker: () => {
      setSettingsColorPicker(false);
      setSettingsColorIndex(0);
    },
    onSettingsSetDefault: () => {
      const items = settingsItems();
      const item = items[settingsIndex];
      if (item) args.settingsState.makeDefault(item.id);
    },
    onSettingsDelete: () => {
      const items = settingsItems();
      const item = items[settingsIndex];
      if (!item) return;
      if (args.settingsState.section === "statuses") {
        args.settingsState.removeStatus(item.id);
      } else {
        args.settingsState.removeTag(item.id);
      }
      setSettingsIndex((i) => Math.min(i, items.length - 2));
    },
    onSettingsNameSubmit: (name: string) => {
      if (!name.trim()) {
        setSettingsCreateStep("idle");
        return;
      }
      setSettingsCreateName(name.trim());
      setSettingsCreateStep("color");
      setSettingsColorIndex(0);
    },
  });

  const settingsNameSubmit = (name: string) => {
    if (!name.trim()) {
      setSettingsCreateStep("idle");
      return;
    }
    setSettingsCreateName(name.trim());
    setSettingsCreateStep("color");
    setSettingsColorIndex(0);
  };

  return {
    pickerIndex,
    agentIndex,
    archiveTarget,
    settingsIndex,
    settingsColorIndex,
    settingsColorPicker,
    settingsCreateStep,
    settingsNameSubmit,
  };
}
