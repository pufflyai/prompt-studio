import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type {
  ExtensionSetupContext,
  HarnessApprovalService,
  HarnessEventStore,
  HarnessModel,
  HarnessProviderDefinition,
  HarnessResumeResult,
  HarnessSessionMessageInput,
  HarnessSessionMessagesInput,
  HarnessSessionStartInput,
  HarnessSessionStartResult,
} from "@pstdio/sdk/extensions";
import type { SessionMessage } from "pstdio-agents";
import { normalizeClaudeCodeMessages } from "./claude-code-normalizer";
import { spawnClaudeCodeMessage, spawnClaudeCodeSession } from "./claude-code-spawn";
import type { ClaudeCodeTranscriptEntry } from "./claude-code-types";

// --- Env ---

const cleanEnv = () => {
  const { CLAUDECODE, ...rest } = process.env;
  return rest;
};

// --- Dependency injection ---

type ClaudeCodeDeps = {
  isCommandAvailable: () => boolean;
  readTranscript: (sessionId: string, cwd?: string) => Promise<string>;
};

// --- Availability ---

const isClaudeInstalled = () => {
  const result = spawnSync("claude", ["--version"], { stdio: "ignore", env: cleanEnv() });
  return result.status === 0;
};

// --- Transcript path ---

export const buildTranscriptPath = (sessionId: string, cwd?: string) => {
  const projectDir = cwd ?? process.cwd();
  const sanitized = projectDir.replace(/\//g, "-");
  return `${process.env.HOME}/.claude/projects/${sanitized}/${sessionId}.jsonl`;
};

// --- Transcript reading ---

const defaultReadTranscript = async (sessionId: string, cwd?: string) => {
  const path = buildTranscriptPath(sessionId, cwd);

  try {
    const content = readFileSync(path, "utf8");
    return content;
  } catch {
    return "";
  }
};

// --- Transcript parsing ---

const isValidEntry = (parsed: unknown): parsed is ClaudeCodeTranscriptEntry => {
  if (!parsed || typeof parsed !== "object") return false;

  const record = parsed as Record<string, unknown>;

  if (typeof record.uuid !== "string" || record.uuid.length === 0) return false;
  if (!record.message) return false;

  return true;
};

const parseTranscript = (content: string): ClaudeCodeTranscriptEntry[] => {
  if (!content.trim()) return [];

  const seen = new Map<string, number>();
  const entries: ClaudeCodeTranscriptEntry[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (!isValidEntry(parsed)) continue;
      const existingIndex = seen.get(parsed.uuid);

      if (existingIndex !== undefined) {
        entries[existingIndex] = parsed;
        continue;
      }

      seen.set(parsed.uuid, entries.length);
      entries.push(parsed);
    } catch {
      // skip malformed lines
    }
  }

  return entries;
};

// --- Models ---

const knownModels: HarnessModel[] = [{ id: "sonnet" }, { id: "opus" }, { id: "haiku" }];

// --- Factory ---

const defaultDeps: ClaudeCodeDeps = {
  isCommandAvailable: isClaudeInstalled,
  readTranscript: defaultReadTranscript,
};

type ClaudeCodeHarnessProvider = HarnessProviderDefinition & {
  getMessages(sessionId: string, input?: HarnessSessionMessagesInput): Promise<SessionMessage[]>;
  startSession(input: HarnessSessionStartInput): Promise<HarnessSessionStartResult>;
  resumeSession(
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
    approvalService?: HarnessApprovalService,
  ): Promise<HarnessResumeResult>;
};

export const createClaudeCodeHarnessProvider = (overrides: Partial<ClaudeCodeDeps> = {}): ClaudeCodeHarnessProvider => {
  const deps = { ...defaultDeps, ...overrides };

  function getMessages(sessionId: string, input?: HarnessSessionMessagesInput): Promise<SessionMessage[]>;
  function getMessages(
    _ctx: ExtensionSetupContext,
    sessionId: string,
    input?: HarnessSessionMessagesInput,
  ): Promise<SessionMessage[]>;
  async function getMessages(
    ctxOrSessionId: ExtensionSetupContext | string,
    sessionIdOrInput?: string | HarnessSessionMessagesInput,
    maybeInput?: HarnessSessionMessagesInput,
  ) {
    const sessionId = typeof ctxOrSessionId === "string" ? ctxOrSessionId : (sessionIdOrInput as string);
    const input = typeof ctxOrSessionId === "string" ? (sessionIdOrInput as HarnessSessionMessagesInput) : maybeInput;
    const cwd = input?.cwd ?? undefined;
    const content = await deps.readTranscript(sessionId, cwd);
    const entries = parseTranscript(content);
    return normalizeClaudeCodeMessages(entries);
  }

  function startSession(input: HarnessSessionStartInput): Promise<HarnessSessionStartResult>;
  function startSession(
    _ctx: ExtensionSetupContext,
    input: HarnessSessionStartInput,
  ): Promise<HarnessSessionStartResult>;
  async function startSession(
    ctxOrInput: ExtensionSetupContext | HarnessSessionStartInput,
    maybeInput?: HarnessSessionStartInput,
  ) {
    const input = maybeInput ?? (ctxOrInput as HarnessSessionStartInput);
    return spawnClaudeCodeSession(input);
  }

  function resumeSession(
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
    approvalService?: HarnessApprovalService,
  ): Promise<HarnessResumeResult>;
  function resumeSession(
    _ctx: ExtensionSetupContext,
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
    approvalService?: HarnessApprovalService,
  ): Promise<HarnessResumeResult>;
  async function resumeSession(
    ctxOrInput: ExtensionSetupContext | HarnessSessionMessageInput,
    inputOrEventStore: HarnessSessionMessageInput | HarnessEventStore,
    eventStoreOrApprovalService?: HarnessEventStore | HarnessApprovalService,
    maybeApprovalService?: HarnessApprovalService,
  ) {
    const input = "sessionId" in ctxOrInput ? ctxOrInput : (inputOrEventStore as HarnessSessionMessageInput);
    const eventStore =
      "sessionId" in ctxOrInput
        ? (inputOrEventStore as HarnessEventStore)
        : (eventStoreOrApprovalService as HarnessEventStore);
    const approvalService =
      "sessionId" in ctxOrInput
        ? (eventStoreOrApprovalService as HarnessApprovalService | undefined)
        : maybeApprovalService;
    const process = await spawnClaudeCodeMessage(input, eventStore, approvalService);
    return { process };
  }

  return {
    id: "pstdio.harness.claude-code",
    label: "Claude Code",
    async detect() {
      return deps.isCommandAvailable()
        ? { available: true }
        : { available: false, reason: "Claude Code executable was not found." };
    },
    listModels: () => (deps.isCommandAvailable() ? knownModels : []),
    async start(_ctx, input) {
      const result = await startSession({
        prompt: input.prompt ?? "",
        cwd: input.workspacePath,
        env: { PSTDIO_SESSION_ID: input.sessionId },
      });

      return {
        runId: result.sessionId,
        onExit: result.process?.onExit,
      };
    },
    startSession,
    resumeSession,
    getMessages,
  };
};
