import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import type {
  AgentCapability,
  AgentModel,
  AgentService,
  AvailabilityInfo,
  LaunchInput,
  LaunchResult,
  SessionExport,
  SessionListEntry,
  SessionMessage,
  SessionMessagesInput,
  SessionStartInput,
} from "../../types";
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

const buildProjectDir = (cwd?: string) => {
  const projectDir = cwd ?? process.cwd();
  const sanitized = projectDir.replace(/\//g, "-");
  return `${process.env.HOME}/.claude/projects/${sanitized}`;
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

const knownModels: AgentModel[] = [{ id: "sonnet" }, { id: "opus" }, { id: "haiku" }];

// --- Factory ---

const defaultDeps: ClaudeCodeDeps = {
  isCommandAvailable: isClaudeInstalled,
  readTranscript: defaultReadTranscript,
};

export const createClaudeCodeAgent = (overrides: Partial<ClaudeCodeDeps> = {}): AgentService => {
  const deps = { ...defaultDeps, ...overrides };

  const checkAvailability = (): AvailabilityInfo =>
    deps.isCommandAvailable() ? { type: "INSTALLED" } : { type: "NOT_FOUND" };

  const listModels = (): AgentModel[] => (deps.isCommandAvailable() ? knownModels : []);

  const capabilities = (): AgentCapability[] => ["SessionFork", "ContextUsage", "Approvals"];

  const getMessages = async (sessionId: string, input?: SessionMessagesInput): Promise<SessionMessage[]> => {
    const cwd = input?.cwd ?? undefined;
    const content = await deps.readTranscript(sessionId, cwd);
    const entries = parseTranscript(content);
    return normalizeClaudeCodeMessages(entries);
  };

  const startSession = async (input: SessionStartInput) => {
    const result = await spawnClaudeCodeSession(input);
    return result;
  };

  const resumeSession = async (
    input: Parameters<AgentService["resumeSession"]>[0],
    eventStore: Parameters<AgentService["resumeSession"]>[1],
    approvalService?: Parameters<AgentService["resumeSession"]>[2],
  ) => {
    const process = await spawnClaudeCodeMessage(input, eventStore, approvalService);
    return { process };
  };

  const listSessions = async (input?: { cwd?: string }): Promise<SessionListEntry[]> => {
    const dir = buildProjectDir(input?.cwd);

    try {
      const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));

      return files.map((file) => {
        const sessionId = file.replace(/\.jsonl$/, "");
        const filePath = `${dir}/${file}`;
        const stat = statSync(filePath);

        return {
          id: sessionId,
          title: sessionId,
          directory: input?.cwd ?? process.cwd(),
          updatedAt: stat.mtime.toISOString(),
        };
      });
    } catch {
      return [];
    }
  };

  const exportSession = async (sessionId: string): Promise<SessionExport> => {
    const messages = await getMessages(sessionId);

    return {
      session: {
        id: sessionId,
        title: sessionId,
        directory: process.cwd(),
        updatedAt: new Date().toISOString(),
      },
      messages,
    };
  };

  const launchSession = async (input: LaunchInput): Promise<LaunchResult> => {
    const args = ["--output-format", "stream-json", "--input-format", "stream-json", "--verbose"];

    if (input.model) {
      args.push("--model", input.model);
    }

    const child = spawn("claude", args, {
      stdio: ["pipe", "ignore", "ignore"],
      detached: true,
      cwd: input.cwd,
      env: cleanEnv(),
    });

    child.stdin?.write(`${JSON.stringify({ type: "user", message: { role: "user", content: input.prompt } })}\n`);
    child.stdin?.end();
    child.unref();

    return { pid: child.pid };
  };

  return {
    id: "claude-code",
    name: "Claude Code",
    capabilities,
    checkAvailability,
    listModels,
    startSession,
    resumeSession,
    getMessages,
    listSessions,
    exportSession,
    launchSession,
  };
};
