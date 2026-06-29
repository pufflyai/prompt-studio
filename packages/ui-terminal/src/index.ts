export { type BindSessionOptions, bindSessionToSink, type TerminalSink } from "./bind-session";
export {
  createScriptedTerminalBridge,
  type ScriptedBridgeOptions,
  type ScriptedTerminalStep,
} from "./scripted-bridge";
export { Terminal, type TerminalProps } from "./terminal";
export {
  darkTerminalTheme,
  lightTerminalTheme,
  resolveTerminalTheme,
  type TerminalThemeName,
  terminalThemes,
} from "./terminal-theme";
export type {
  TerminalBridge,
  TerminalSessionAdapter,
  TerminalSessionError,
  TerminalSessionExit,
  TerminalSessionRequest,
} from "./types";
export {
  type TerminalSessionStatus,
  type UseTerminalSessionOptions,
  type UseTerminalSessionResult,
  useTerminalSession,
} from "./use-terminal-session";
