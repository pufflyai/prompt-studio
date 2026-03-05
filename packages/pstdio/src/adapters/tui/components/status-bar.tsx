import { Box, Text } from "ink";

import type { Mode } from "../app";

interface StatusBarProps {
  mode: Mode;
  error: string;
  width: number;
  connected: boolean;
}

interface KeyHint {
  key: string;
  label: string;
}

const OVERLAY_KEYS: KeyHint[] = [{ key: "esc", label: "close" }];

const INPUT_KEYS: KeyHint[] = [
  { key: "enter", label: "confirm" },
  { key: "esc", label: "cancel" },
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

const CONFIRM_KEYS: KeyHint[] = [
  { key: "enter", label: "confirm" },
  { key: "esc", label: "cancel" },
];

const SETTINGS_KEYS: KeyHint[] = [
  { key: "n", label: "new" },
  { key: "c", label: "color" },
  { key: "d", label: "default" },
  { key: "x", label: "delete" },
  { key: "esc", label: "back" },
];

const TICKETS_KEYS: KeyHint[] = [
  { key: "n", label: "new" },
  { key: "e", label: "edit" },
  { key: "x", label: "arch" },
  { key: "?", label: "?" },
];

const DOCS_KEYS: KeyHint[] = [
  { key: "enter", label: "open" },
  { key: "/", label: "search" },
  { key: "?", label: "help" },
];

const TEMPLATES_KEYS: KeyHint[] = [
  { key: "d", label: "default" },
  { key: "enter", label: "view" },
  { key: "?", label: "help" },
];

const TAB_HINTS: Record<string, KeyHint[]> = {
  tickets: TICKETS_KEYS,
  docs: DOCS_KEYS,
  templates: TEMPLATES_KEYS,
};

const getHints = (mode: Mode): KeyHint[] => {
  if (mode.search) return INPUT_KEYS;
  if (mode.overlay === "confirm-archive") return CONFIRM_KEYS;
  if (mode.overlay === "help" || mode.overlay === "view") return OVERLAY_KEYS;
  if (mode.overlay === "projects" || mode.overlay === "status-picker") return PICKER_KEYS;
  if (mode.overlay === "agents") return AGENT_KEYS;
  if (mode.overlay === "ticket-create") return INPUT_KEYS;
  if (mode.overlay === "settings") return SETTINGS_KEYS;
  return TAB_HINTS[mode.tab] ?? DOCS_KEYS;
};

export function StatusBar({ mode, error, width, connected }: StatusBarProps) {
  const hints = getHints(mode);

  return (
    <Box flexDirection="column">
      {error && (
        <Box>
          <Text color="red"> {error}</Text>
        </Box>
      )}

      <Box>
        <Text color={connected ? "green" : "red"}>{connected ? "synced" : "disconnected"}</Text>

        <Text> </Text>

        {hints.map((hint, i) => (
          <Text key={hint.key}>
            {i > 0 && <Text dimColor> </Text>}
            <Text bold color="cyan">
              {hint.key}
            </Text>
            <Text dimColor>:{hint.label}</Text>
          </Text>
        ))}

        <Text>{"".padEnd(Math.max(0, width - 80))}</Text>
      </Box>
    </Box>
  );
}
