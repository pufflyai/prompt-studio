import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import pino, { type Logger } from "pino";
import { expandHomePath, resolvePstdioHome } from "pstdio-paths";

type LoggerEnv = Partial<
  Record<
    | "HOME"
    | "PSTDIO_DB_PATH"
    | "PSTDIO_HOME"
    | "PSTDIO_LOG_LEVEL"
    | "PSTDIO_LOG_PATH"
    | "PSTDIO_LOG_TARGETS"
    | "PSTDIO_STATE_DIR"
    | "PSTDIO_STORAGE_PATH",
    string
  >
>;

export type LogTarget =
  | {
      type: "file";
      path?: string;
      sync?: boolean;
    }
  | {
      type: "stdout";
    };

type ResolveLogPathInput = {
  dbPath?: string;
  env?: LoggerEnv;
  homedirPath?: string;
  logPath?: string;
  stateDir?: string;
  storagePath?: string;
};

type CreateLoggerInput = ResolveLogPathInput & {
  base?: Record<string, unknown>;
  component?: string;
  level?: string;
  service: string;
  sync?: boolean;
  targets?: LogTarget[];
};

const DEFAULT_LOG_FILE_NAME = "logs.jsonl";
const REDACTED = "[Redacted]";
const SENSITIVE_TEXT_PATTERNS = [
  /(\bbearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /(\b(?:authorization|api[_-]?token|access[_-]?token|refresh[_-]?token|token|password|secret)\b\s*[:=]\s*)[^\s,;&]+/gi,
  /([?&](?:api[_-]?token|access[_-]?token|refresh[_-]?token|token|password|secret)=)[^&#\s]*/gi,
  /(--(?:api[_-]?token|token|password|secret)\s+)[^\s]+/gi,
] as const;
const DEFAULT_REDACT_PATHS = [
  "apiToken",
  "*.apiToken",
  "api_token",
  "*.api_token",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "*.headers.authorization",
  "password",
  "*.password",
  "secret",
  "*.secret",
  "token",
  "*.token",
];

export const redactSensitiveText = (value: string, secrets: string[] = []) => {
  let redacted = value;
  for (const secret of secrets.filter(Boolean).sort((left, right) => right.length - left.length)) {
    redacted = redacted.replaceAll(secret, REDACTED);
  }
  for (const pattern of SENSITIVE_TEXT_PATTERNS) {
    redacted = redacted.replace(pattern, `$1${REDACTED}`);
  }
  return redacted;
};

const resolveStateDirectory = (input: ResolveLogPathInput = {}) => {
  const env = input.env ?? process.env;
  const homePath = input.homedirPath ?? homedir();
  const expanded = (value: string) => expandHomePath(value, homePath);

  const explicitStateDir = input.stateDir ?? env.PSTDIO_STATE_DIR;
  if (explicitStateDir) {
    return expanded(explicitStateDir);
  }

  const resolvedDbPath = input.dbPath ?? env.PSTDIO_DB_PATH;
  if (resolvedDbPath && resolvedDbPath !== ":memory:") {
    return dirname(expanded(resolvedDbPath));
  }

  const resolvedStoragePath = input.storagePath ?? env.PSTDIO_STORAGE_PATH;
  if (resolvedStoragePath) {
    return dirname(expanded(resolvedStoragePath));
  }

  return resolvePstdioHome({ env, homedirPath: homePath });
};

export const resolveDefaultLogPath = (input: ResolveLogPathInput = {}) => {
  const env = input.env ?? process.env;
  const homePath = input.homedirPath ?? homedir();
  const expanded = (value: string) => expandHomePath(value, homePath);
  const explicitLogPath = input.logPath ?? env.PSTDIO_LOG_PATH;

  if (explicitLogPath) {
    return expanded(explicitLogPath);
  }

  return join(resolveStateDirectory(input), DEFAULT_LOG_FILE_NAME);
};

const parseTargetListFromEnv = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): LogTarget | null => {
      if (entry === "stdout") {
        return { type: "stdout" };
      }

      if (entry === "file") {
        return { type: "file" };
      }

      return null;
    })
    .filter((entry): entry is LogTarget => entry !== null);

  return parsed.length > 0 ? parsed : null;
};

type ResolvedTarget =
  | {
      type: "file";
      path: string;
      sync: boolean;
    }
  | {
      type: "stdout";
    };

const resolveSupplementalTargets = (input: CreateLoggerInput): ResolvedTarget[] => {
  const env = input.env ?? process.env;
  const parsedTargets = parseTargetListFromEnv(env.PSTDIO_LOG_TARGETS);
  const configuredTargets = input.targets ?? parsedTargets;
  const targets = configuredTargets ?? [{ type: "file" as const }];

  return targets.map((target) => {
    if (target.type === "stdout") {
      return { type: "stdout" as const };
    }

    return {
      type: "file" as const,
      path: resolveDefaultLogPath({
        dbPath: input.dbPath,
        env: input.env,
        homedirPath: input.homedirPath,
        logPath: target.path ?? input.logPath,
        stateDir: input.stateDir,
        storagePath: input.storagePath,
      }),
      sync: target.sync ?? input.sync ?? false,
    };
  });
};

const resolveTargets = (input: CreateLoggerInput): ResolvedTarget[] => {
  const supplementalTargets = resolveSupplementalTargets(input).filter((target) => target.type !== "stdout");
  return [{ type: "stdout" as const }, ...supplementalTargets];
};

const createStreams = (targets: ReturnType<typeof resolveTargets>) =>
  targets.map((target) => {
    if (target.type === "stdout") {
      return { stream: process.stdout };
    }

    mkdirSync(dirname(target.path), { recursive: true });
    return {
      stream: pino.destination({
        dest: target.path,
        mkdir: true,
        sync: target.sync,
      }),
    };
  });

export const createLogger = (input: CreateLoggerInput): Logger => {
  const streams = createStreams(resolveTargets(input));
  const logger = pino(
    {
      base: { service: input.service, ...(input.base ?? {}) },
      level: input.level ?? input.env?.PSTDIO_LOG_LEVEL ?? process.env.PSTDIO_LOG_LEVEL ?? "error",
      redact: {
        censor: REDACTED,
        paths: DEFAULT_REDACT_PATHS,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams, { dedupe: true }),
  );

  if (input.component) {
    return logger.child({ component: input.component });
  }

  return logger;
};
