import { Box, Text, useApp } from "ink";
import { useState } from "react";

import type { DocRow } from "@/features/docs/types";
import { InputBar } from "./components/input-bar";
import { StatusBar } from "./components/status-bar";
import { useAgents } from "./hooks/use-agents";
import { useDocs } from "./hooks/use-docs";
import { useKeyboard } from "./hooks/use-keyboard";
import { useProject } from "./hooks/use-project";
import { useSelection } from "./hooks/use-selection";
import { useSync } from "./hooks/use-sync";
import { useTerminalSize } from "./hooks/use-terminal-size";
import { AgentManager } from "./panels/agent-manager";
import { DocsList } from "./panels/docs-list";
import { HelpModal } from "./panels/help-modal";
import { MarkdownView } from "./panels/markdown-view";
import { ProjectPicker } from "./panels/project-picker";

export type Mode = "normal" | "search" | "help" | "view" | "projects" | "agents";

const HEADER_LINES = 2;
const FOOTER_LINES = 2;
const INPUT_LINES = 1;

export function App() {
  const { exit } = useApp();
  const { columns, rows: termRows } = useTerminalSize();
  const sync = useSync();
  const docs = useDocs();
  const projectState = useProject();
  const agentState = useAgents();

  const [mode, setMode] = useState<Mode>("normal");
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewContent, setViewContent] = useState({ title: "", content: "" });
  const [pickerIndex, setPickerIndex] = useState(0);
  const [agentIndex, setAgentIndex] = useState(0);

  const inputActive = mode === "search";
  const chrome = HEADER_LINES + FOOTER_LINES + (inputActive ? INPUT_LINES : 0);
  const viewportHeight = Math.max(1, termRows - chrome);

  const allRows = docs.getRows(expanded);

  const rows: DocRow[] = searchQuery
    ? allRows.filter((r) => r.item.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : allRows;

  const { selectedIndex, scrollOffset, moveTo, resetSelection } = useSelection(rows.length, viewportHeight);
  const selectedRow = rows[selectedIndex];

  const toggleExpand = () => {
    if (!selectedRow) return;

    if (selectedRow.hasChildren) {
      setExpanded((prev) => {
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
      const content = docs.getDocument(selectedRow.item.link);
      setViewContent({ title: selectedRow.item.text, content: content ?? "" });
      setMode("view");
    }
  };

  const handleSearchSubmit = (value: string) => {
    setSearchQuery(value);
    resetSelection();
    setMode("normal");
    setInputValue("");
  };

  useKeyboard({
    mode,
    setMode,
    exit,
    selectedIndex,
    rowCount: rows.length,
    moveTo,
    resetSelection,
    toggleExpand,
    openDocument: () => {
      if (!selectedRow?.item.link) return;
      const content = docs.getDocument(selectedRow.item.link);
      setViewContent({ title: selectedRow.item.text, content: content ?? "" });
      setMode("view");
    },
    setInputValue,
    setSearchQuery,
    pickerCount: projectState.projects.length,
    setPickerIndex,
    onPickerSelect: () => {
      const selected = projectState.projects[pickerIndex];
      if (selected) projectState.switchProject(selected.id);
    },
    onPickerOpen: () => {
      setPickerIndex(0);
      projectState.loadProjects();
    },
    agentCount: agentState.agents.length,
    setAgentIndex,
    onAgentOpen: () => {
      setAgentIndex(0);
      agentState.loadAgents();
    },
    onAgentSetup: () => {
      const selected = agentState.agents[agentIndex];
      if (selected?.configured === false) agentState.setup(selected.agentId);
    },
    onAgentRemove: () => {
      const selected = agentState.agents[agentIndex];
      if (selected?.configured) agentState.remove(selected.agentId);
    },
    onAgentSetDefault: () => {
      const selected = agentState.agents[agentIndex];
      if (selected?.configured) agentState.setDefault(selected.agentId);
    },
  });

  const separator = "─".repeat(columns);

  return (
    <Box flexDirection="column" width={columns} height={termRows}>
      <Box>
        <Text bold color="cyan">
          {" pstdio "}
        </Text>

        <Text dimColor>│</Text>

        <Text> {projectState.project?.name ?? "No project"} </Text>

        <Text dimColor>│</Text>

        <Text> {rows.length} docs</Text>

        {searchQuery && (
          <Text>
            <Text dimColor> │ filter: </Text>
            <Text color="yellow">{searchQuery}</Text>
          </Text>
        )}
      </Box>

      <Text dimColor>{separator}</Text>

      {mode === "help" ? (
        <HelpModal width={columns} viewportHeight={viewportHeight} />
      ) : mode === "view" ? (
        <MarkdownView
          title={viewContent.title}
          content={viewContent.content}
          width={columns}
          viewportHeight={viewportHeight}
        />
      ) : mode === "projects" ? (
        <ProjectPicker
          projects={projectState.projects}
          currentProjectId={projectState.project?.id ?? null}
          selectedIndex={pickerIndex}
          width={columns}
          viewportHeight={viewportHeight}
        />
      ) : mode === "agents" ? (
        <AgentManager
          agents={agentState.agents}
          selectedIndex={agentIndex}
          width={columns}
          viewportHeight={viewportHeight}
        />
      ) : (
        <DocsList
          rows={rows}
          selectedIndex={selectedIndex}
          expanded={expanded}
          viewportHeight={viewportHeight}
          scrollOffset={scrollOffset}
          width={columns}
        />
      )}

      {inputActive && (
        <InputBar label="Search" value={inputValue} onChange={setInputValue} onSubmit={handleSearchSubmit} />
      )}

      <StatusBar
        mode={mode}
        docCount={rows.length}
        error={docs.error || projectState.error || agentState.error}
        width={columns}
        connected={sync.connected}
      />
    </Box>
  );
}
