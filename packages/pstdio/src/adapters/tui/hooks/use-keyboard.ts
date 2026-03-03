import { useInput } from "ink";
import type { Mode } from "../app";

interface KeyboardDeps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  exit: () => void;
  // docs navigation
  selectedIndex: number;
  rowCount: number;
  moveTo: (index: number) => void;
  resetSelection: () => void;
  toggleExpand: () => void;
  openDocument: () => void;
  setInputValue: (value: string) => void;
  setSearchQuery: (query: string) => void;
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
}

const handleModalInput = (input: string, key: { escape: boolean }, closeKey: string, close: () => void) => {
  if (input === closeKey || key.escape) close();
};

export function useKeyboard(deps: KeyboardDeps) {
  useInput((input, key) => {
    if (deps.mode === "help") {
      handleModalInput(input, key, "?", () => deps.setMode("normal"));
      return;
    }

    if (deps.mode === "view") {
      handleModalInput(input, key, "v", () => deps.setMode("normal"));
      return;
    }

    if (deps.mode === "projects") {
      handleProjectsInput(input, key, deps);
      return;
    }

    if (deps.mode === "agents") {
      handleAgentsInput(input, key, deps);
      return;
    }

    if (deps.mode === "search") {
      if (key.escape) {
        deps.setSearchQuery("");
        deps.resetSelection();
        deps.setMode("normal");
        deps.setInputValue("");
      }
      return;
    }

    handleNormalInput(input, key, deps);
  });
}

function handleProjectsInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (key.escape) {
    deps.setMode("normal");
    return;
  }

  if (input === "j" || key.downArrow) {
    deps.setPickerIndex((i) => Math.min(i + 1, deps.pickerCount - 1));
    return;
  }

  if (input === "k" || key.upArrow) {
    deps.setPickerIndex((i) => Math.max(i - 1, 0));
    return;
  }

  if (key.return && deps.pickerCount > 0) {
    deps.onPickerSelect();
    deps.setMode("normal");
  }
}

function handleNormalInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (input === "q") {
    deps.exit();
    return;
  }

  if (input === "j" || key.downArrow) {
    deps.moveTo(deps.selectedIndex + 1);
    return;
  }

  if (input === "k" || key.upArrow) {
    deps.moveTo(deps.selectedIndex - 1);
    return;
  }

  if (input === "g") {
    deps.moveTo(0);
    return;
  }

  if (input === "G") {
    deps.moveTo(deps.rowCount - 1);
    return;
  }

  if (key.return) {
    deps.toggleExpand();
    return;
  }

  if (input === "/") {
    deps.setMode("search");
    deps.setInputValue("");
    return;
  }

  if (input === "?") {
    deps.setMode("help");
    return;
  }

  if (input === "p") {
    deps.onPickerOpen();
    deps.setMode("projects");
    return;
  }

  if (input === "a") {
    deps.onAgentOpen();
    deps.setMode("agents");
    return;
  }

  if (input === "v") {
    deps.openDocument();
  }
}

function handleAgentsInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (key.escape) {
    deps.setMode("normal");
    return;
  }

  if (input === "j" || key.downArrow) {
    deps.setAgentIndex((i) => Math.min(i + 1, deps.agentCount - 1));
    return;
  }

  if (input === "k" || key.upArrow) {
    deps.setAgentIndex((i) => Math.max(i - 1, 0));
    return;
  }

  if (input === "s") {
    deps.onAgentSetup();
    return;
  }

  if (input === "d") {
    deps.onAgentRemove();
    return;
  }

  if (key.return && deps.agentCount > 0) {
    deps.onAgentSetDefault();
  }
}
