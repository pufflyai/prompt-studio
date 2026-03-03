import { Box, Text } from "ink";

interface HelpModalProps {
  width: number;
  viewportHeight: number;
}

interface Shortcut {
  key: string;
  label: string;
}

const NAVIGATION: Shortcut[] = [
  { key: "j / ↓", label: "Move down" },
  { key: "k / ↑", label: "Move up" },
  { key: "g", label: "Go to first" },
  { key: "G", label: "Go to last" },
  { key: "enter", label: "Expand / collapse / open" },
];

const ACTIONS: Shortcut[] = [
  { key: "enter", label: "Open / expand" },
  { key: "v", label: "View document" },
  { key: "a", label: "Manage agents" },
  { key: "p", label: "Switch project" },
];

const OTHER: Shortcut[] = [
  { key: "/", label: "Search" },
  { key: "?", label: "Toggle help" },
  { key: "q", label: "Quit" },
];

const SECTIONS = [
  { title: "Navigation", shortcuts: NAVIGATION },
  { title: "Actions", shortcuts: ACTIONS },
  { title: "Other", shortcuts: OTHER },
];

const KEY_COL_WIDTH = 12;

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

export function HelpModal({ width, viewportHeight }: HelpModalProps) {
  const contentLines = SECTIONS.reduce((sum, s) => sum + 1 + s.shortcuts.length + 1, 0) + 3;
  const topPad = Math.max(0, Math.floor((viewportHeight - contentLines) / 2));
  const bottomPad = Math.max(0, viewportHeight - contentLines - topPad);

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box height={topPad} />

      <Box justifyContent="center">
        <Text bold> Keyboard Shortcuts </Text>
      </Box>

      <Text> </Text>

      {SECTIONS.map((section) => (
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
