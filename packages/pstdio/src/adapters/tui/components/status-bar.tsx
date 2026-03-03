import { Box, Text } from "ink";

import type { Mode } from "../app";

interface StatusBarProps {
  mode: Mode;
  docCount: number;
  error: string;
  width: number;
  connected: boolean;
}

interface KeyHint {
  key: string;
  label: string;
}

const NORMAL_KEYS: KeyHint[] = [
  { key: "a", label: "agents" },
  { key: "p", label: "projects" },
  { key: "?", label: "help" },
];

const INPUT_KEYS: KeyHint[] = [
  { key: "enter", label: "confirm" },
  { key: "esc", label: "cancel" },
];

const VIEW_KEYS: KeyHint[] = [
  { key: "esc", label: "close" },
  { key: "v", label: "close" },
];

const PICKER_KEYS: KeyHint[] = [
  { key: "enter", label: "select" },
  { key: "esc", label: "cancel" },
];

const AGENT_KEYS: KeyHint[] = [
  { key: "s", label: "setup" },
  { key: "d", label: "remove" },
  { key: "enter", label: "default" },
  { key: "esc", label: "cancel" },
];

const HINTS_BY_MODE: Record<Mode, KeyHint[]> = {
  normal: NORMAL_KEYS,
  help: NORMAL_KEYS,
  search: INPUT_KEYS,
  view: VIEW_KEYS,
  projects: PICKER_KEYS,
  agents: AGENT_KEYS,
};

export function StatusBar({ mode, docCount, error, width, connected }: StatusBarProps) {
  const hints = HINTS_BY_MODE[mode];

  return (
    <Box flexDirection="column">
      {error && (
        <Box>
          <Text color="red"> {error}</Text>
        </Box>
      )}

      <Box>
        <Text backgroundColor="gray" color="white">
          {" "}
          {docCount} doc(s){" "}
        </Text>

        <Text> </Text>

        <Text color={connected ? "green" : "red"}>{connected ? "synced" : "disconnected"}</Text>

        <Text> </Text>

        {hints.map((hint, i) => (
          <Text key={hint.key}>
            {i > 0 && <Text dimColor> </Text>}
            <Text bold color="cyan">
              {hint.key}
            </Text>
            <Text dimColor> {hint.label}</Text>
          </Text>
        ))}

        <Text>{"".padEnd(Math.max(0, width - 80))}</Text>
      </Box>
    </Box>
  );
}
