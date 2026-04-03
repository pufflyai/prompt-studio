import { createLogger } from "pstdio-logging";

const normalized = (token: string) => (token === "workspaces" ? "workspace" : token);
const normalizeCommandPath = (tokens: string[]) => tokens.map(normalized).join(" ").trim();

export const MUTATING_CLI_COMMANDS = new Set([
  "agents install-plugins",
  "agents install-skills",
  "agents remove",
  "agents setup",
  "agents update",
  "hooks create",
  "hooks run",
  "projects create",
  "projects delete",
  "projects link",
  "projects unlink",
  "sessions approve",
  "sessions archive",
  "sessions create",
  "sessions deny",
  "sessions follow-up",
  "sessions stop",
  "statuses create",
  "statuses delete",
  "statuses set-default",
  "tags create",
  "tags delete",
  "templates create",
  "templates delete",
  "templates update",
  "templates write",
  "tickets archive",
  "tickets create",
  "tickets delete",
  "tickets implement",
  "tickets pull",
  "tickets save",
  "tickets update",
  "tickets update-when-attempt-status",
  "tickets worktrees remove-all",
  "tickets write",
  "workspace create",
  "workspace delete",
  "workspace merge",
  "workspace set-status",
]);

export const isMutatingCliCommand = (tokens: string[]) => MUTATING_CLI_COMMANDS.has(normalizeCommandPath(tokens));

const asStringArray = (values: unknown[]) => values.filter((value): value is string => typeof value === "string");

const extractCommandTokensFromRawArgs = (rawArgs: string[]) => {
  const tokens: string[] = [];

  for (const arg of rawArgs) {
    if (arg.startsWith("-")) {
      continue;
    }

    if (arg.includes("=") && arg.startsWith("--")) {
      continue;
    }

    tokens.push(arg);
    if (tokens.length >= 3) {
      break;
    }
  }

  return tokens;
};

type TrackerInput = {
  logger?: {
    error: (data: Record<string, unknown>, message: string) => void;
    info: (data: Record<string, unknown>, message: string) => void;
  };
  now?: () => number;
  rawArgs: string[];
  sessionId?: string;
};

export const createCliCommandTracker = (input: TrackerInput) => {
  let resolvedLogger = input.logger;
  const now = input.now ?? (() => Date.now());
  let tokens = extractCommandTokensFromRawArgs(input.rawArgs);
  let startedAt = 0;
  let started = false;

  const logger = () => {
    if (resolvedLogger) {
      return resolvedLogger;
    }

    resolvedLogger = createLogger({ component: "cli", service: "pstdio", sync: true });
    return resolvedLogger;
  };

  const commandPath = () => normalizeCommandPath(tokens);

  const ensureStarted = () => {
    if (started) {
      return true;
    }

    if (!isMutatingCliCommand(tokens)) {
      return false;
    }

    started = true;
    startedAt = now();
    logger().info(
      {
        command: commandPath(),
        event: "cli.command.start",
        raw_args: input.rawArgs,
        session_id: input.sessionId,
      },
      "CLI mutating command started",
    );
    return true;
  };

  return {
    captureArgv(argv: Record<string, unknown>) {
      const list = Array.isArray(argv._) ? argv._ : [];
      const nextTokens = asStringArray(list);
      if (nextTokens.length > 0) {
        tokens = nextTokens;
      }
    },
    logFailure(error: unknown) {
      if (!ensureStarted()) {
        return;
      }

      logger().error(
        {
          command: commandPath(),
          duration_ms: Math.max(0, now() - startedAt),
          error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
          event: "cli.command.failed",
          session_id: input.sessionId,
        },
        "CLI mutating command failed",
      );
    },
    logStart() {
      ensureStarted();
    },
    logSuccess() {
      if (!ensureStarted()) {
        return;
      }

      logger().info(
        {
          command: commandPath(),
          duration_ms: Math.max(0, now() - startedAt),
          event: "cli.command.completed",
          session_id: input.sessionId,
        },
        "CLI mutating command completed",
      );
    },
  };
};
