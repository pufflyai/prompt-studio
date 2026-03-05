import { Box, Text, useApp } from "ink";
import { useState } from "react";

import { InputBar } from "./components/input-bar";
import { StatusBar } from "./components/status-bar";
import { TabBar } from "./components/tab-bar";
import { useAgents } from "./hooks/use-agents";
import { useAppKeyboard } from "./hooks/use-app-keyboard";
import { useDocs } from "./hooks/use-docs";
import { useProject } from "./hooks/use-project";
import { useSelection } from "./hooks/use-selection";
import { useSettings } from "./hooks/use-settings";
import { useSync } from "./hooks/use-sync";
import { useTemplates } from "./hooks/use-templates";
import { useTerminalSize } from "./hooks/use-terminal-size";
import { useTickets } from "./hooks/use-tickets";
import { DocsList } from "./panels/docs-list";
import { renderOverlay } from "./panels/overlay";
import { TemplateContent } from "./panels/template-content";
import { TemplateList } from "./panels/template-list";
import { TicketContent } from "./panels/ticket-content";
import { TicketList } from "./panels/ticket-list";

export type Tab = "tickets" | "docs" | "templates";
export type Overlay =
  | "help"
  | "view"
  | "projects"
  | "agents"
  | "status-picker"
  | "ticket-create"
  | "confirm-archive"
  | "settings";
export type Mode = { tab: Tab; overlay?: Overlay; search?: boolean };

const TABS: Tab[] = ["tickets", "docs", "templates"];
const TAB_LABELS = ["Tickets", "Docs", "Templates"];

const HEADER_LINES = 3;
const FOOTER_LINES = 2;
const INPUT_LINES = 1;

export function App() {
  const { exit } = useApp();
  const { columns, rows: termRows } = useTerminalSize();
  const sync = useSync();
  const docs = useDocs();
  const projectState = useProject();
  const agentState = useAgents();
  const ticketState = useTickets(projectState.project?.id ?? null);
  const templateState = useTemplates(projectState.project?.id ?? null);
  const settingsState = useSettings(projectState.project?.id ?? null);

  const [mode, setMode] = useState<Mode>({ tab: "tickets" });
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewContent, setViewContent] = useState({ title: "", content: "" });

  const inputActive = mode.search === true;
  const chrome = HEADER_LINES + FOOTER_LINES + (inputActive ? INPUT_LINES : 0);
  const viewportHeight = Math.max(1, termRows - chrome);

  // Docs
  const allRows = docs.getRows(expanded);
  const docsRows = searchQuery
    ? allRows.filter((r) => r.item.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : allRows;
  const docsSelection = useSelection(docsRows.length, viewportHeight);
  const selectedRow = docsRows[docsSelection.selectedIndex];

  // Tickets
  const ticketSelection = useSelection(ticketState.flatRows.length, viewportHeight);

  // Templates
  const templateSelection = useSelection(templateState.items.length, viewportHeight);

  const {
    pickerIndex,
    agentIndex,
    archiveTarget,
    settingsIndex,
    settingsColorIndex,
    settingsColorPicker,
    settingsCreateStep,
    settingsNameSubmit,
  } = useAppKeyboard({
    mode,
    setMode,
    exit,
    docs,
    docsSelection,
    docsRows,
    selectedRow,
    ticketState,
    ticketSelection,
    templateState,
    templateSelection,
    projectState,
    agentState,
    settingsState,
    setInputValue,
    setSearchQuery,
    setViewContent,
    expanded,
    setExpanded,
  });

  const handleSearchSubmit = (value: string) => {
    if (mode.overlay === "ticket-create") {
      if (value.trim()) ticketState.createTicket(value.trim());
      setMode((m) => ({ ...m, overlay: undefined, search: undefined }));
      setInputValue("");
      return;
    }

    if (mode.overlay === "settings" && settingsCreateStep === "name") {
      settingsNameSubmit(value);
      setMode((m) => ({ ...m, search: undefined }));
      setInputValue("");
      return;
    }

    if (mode.tab === "tickets") {
      ticketState.setSearchQuery(value);
      ticketSelection.resetSelection();
    } else {
      setSearchQuery(value);
      docsSelection.resetSelection();
    }
    setMode((m) => ({ ...m, search: undefined }));
    setInputValue("");
  };

  const separator = "─".repeat(columns);
  const activeTabIndex = TABS.indexOf(mode.tab);

  const renderTabContent = () => {
    if (mode.tab === "docs") {
      return (
        <DocsList
          rows={docsRows}
          selectedIndex={docsSelection.selectedIndex}
          expanded={expanded}
          viewportHeight={viewportHeight}
          scrollOffset={docsSelection.scrollOffset}
          width={columns}
        />
      );
    }

    if (mode.tab === "templates") {
      if (templateState.viewingTemplate) {
        return (
          <TemplateContent template={templateState.viewingTemplate} width={columns} viewportHeight={viewportHeight} />
        );
      }
      return (
        <TemplateList
          items={templateState.items}
          selectedIndex={templateSelection.selectedIndex}
          viewportHeight={viewportHeight}
          scrollOffset={templateSelection.scrollOffset}
          width={columns}
        />
      );
    }

    // tickets
    if (ticketState.viewingTicket) {
      return (
        <TicketContent
          ticket={ticketState.viewingTicket}
          statuses={ticketState.statuses}
          width={columns}
          viewportHeight={viewportHeight}
        />
      );
    }
    return (
      <TicketList
        rows={ticketState.flatRows}
        selectedIndex={ticketSelection.selectedIndex}
        expanded={ticketState.expanded}
        viewportHeight={viewportHeight}
        scrollOffset={ticketSelection.scrollOffset}
        width={columns}
      />
    );
  };

  const overlay = renderOverlay({
    mode,
    columns,
    viewportHeight,
    viewContent,
    projects: projectState.projects,
    currentProjectId: projectState.project?.id ?? null,
    pickerIndex,
    agents: agentState.agents,
    agentIndex,
    statuses: ticketState.statuses,
    archiveTarget,
    settingsSection: settingsState.section,
    settingsStatuses: settingsState.statuses,
    settingsTags: settingsState.tags,
    settingsIndex,
    settingsColorPicker,
    settingsColorIndex,
    settingsCreateStep,
  });

  return (
    <Box flexDirection="column" width={columns} height={termRows}>
      <Box>
        <Text bold color="cyan">
          {" pstdio "}
        </Text>
        <Text dimColor>│</Text>
        <Text> {projectState.project?.name ?? "No project"} </Text>
      </Box>

      <TabBar tabs={TAB_LABELS} activeIndex={activeTabIndex} width={columns} />

      <Text dimColor>{separator}</Text>

      {overlay ?? renderTabContent()}

      {inputActive && (
        <InputBar
          label={mode.overlay === "ticket-create" ? "New Ticket" : mode.overlay === "settings" ? "Name" : "Search"}
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSearchSubmit}
        />
      )}

      <StatusBar
        mode={mode}
        error={
          docs.error ||
          projectState.error ||
          agentState.error ||
          ticketState.error ||
          templateState.error ||
          settingsState.error
        }
        width={columns}
        connected={sync.connected}
      />
    </Box>
  );
}
