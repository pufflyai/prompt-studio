import { Box, Text } from "ink";

import type { Tab } from "../app";

interface HelpModalProps {
  tab: Tab;
  width: number;
  viewportHeight: number;
}

interface Shortcut {
  key: string;
  label: string;
}

const NAVIGATION: Shortcut[] = [
  { key: "↓", label: "Move down" },
  { key: "↑", label: "Move up" },
  { key: "g", label: "Go to first" },
  { key: "G", label: "Go to last" },
  { key: "enter", label: "Open / expand" },
];

const TAB_NAV: Shortcut[] = [
  { key: "Tab", label: "Next tab" },
  { key: "Shift+Tab", label: "Previous tab" },
  { key: "1 / 2 / 3", label: "Jump to tab" },
];

const TICKETS_ACTIONS: Shortcut[] = [
  { key: "n", label: "New ticket" },
  { key: "e", label: "Edit status" },
  { key: "i", label: "Implement ticket" },
  { key: "x", label: "Toggle archive" },
  { key: "s", label: "Cycle status filter" },
  { key: "/", label: "Search" },
];

const DOCS_ACTIONS: Shortcut[] = [
  { key: "enter", label: "Expand / open doc" },
  { key: "/", label: "Search docs" },
];

const TEMPLATES_ACTIONS: Shortcut[] = [
  { key: "enter", label: "View template" },
  { key: "d", label: "Set as default" },
];

const GLOBAL: Shortcut[] = [
  { key: "S", label: "Settings (statuses & tags)" },
  { key: "a", label: "Manage agents" },
  { key: "p", label: "Switch project" },
  { key: "?", label: "Toggle help" },
  { key: "q", label: "Quit" },
];

const ACTIONS_BY_TAB: Record<Tab, Shortcut[]> = {
  tickets: TICKETS_ACTIONS,
  docs: DOCS_ACTIONS,
  templates: TEMPLATES_ACTIONS,
};

const KEY_COL_WIDTH = 14;

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <Text>
      {"  "}
      <Text bold color="cyan">
        {shortcut.key.padEnd(KEY_COL_WIDTH)}
      </Text>
      <Text>{shortcut.label}</Text>
    </Text>
  );
}

export function HelpModal({ tab, width, viewportHeight }: HelpModalProps) {
  const sections = [
    { title: "Navigation", shortcuts: NAVIGATION },
    { title: "Tabs", shortcuts: TAB_NAV },
    { title: "Actions", shortcuts: ACTIONS_BY_TAB[tab] },
    { title: "Global", shortcuts: GLOBAL },
  ];

  const contentLines = sections.reduce((sum, s) => sum + 1 + s.shortcuts.length + 1, 0) + 3;
  const topPad = Math.max(0, Math.floor((viewportHeight - contentLines) / 2));
  const bottomPad = Math.max(0, viewportHeight - contentLines - topPad);

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box height={topPad} />

      <Box justifyContent="center">
        <Text bold> Keyboard Shortcuts </Text>
      </Box>

      <Text> </Text>

      {sections.map((section) => (
        <Box key={section.title} flexDirection="column">
          <Text bold dimColor>
            {"  "}
            {section.title}
          </Text>

          {section.shortcuts.map((s) => (
            <ShortcutRow key={s.key} shortcut={s} />
          ))}

          <Text> </Text>
        </Box>
      ))}

      <Box justifyContent="center">
        <Text dimColor>Press ? or esc to close</Text>
      </Box>

      <Box height={bottomPad} />
    </Box>
  );
}
