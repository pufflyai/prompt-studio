import { expandHomePath, resolvePstdioDbPath, resolvePstdioStoragePath } from "pstdio-paths";

const DEFAULT_EVENT_BUFFER_SIZE = 1000;
const DEFAULT_AUTOMATION_RUNS_PER_MINUTE = 60;

export type ExtensionRelease = { source: "git"; ref: string } | { source: "workspace"; ref: string; root: string };

export interface AppConfig {
  database: { path: string };
  storage: { root: string };
  sync: { eventBufferSize: number };
  automation: { runsPerMinute: number };
  extensions: {
    buildWebviews: boolean;
    release: ExtensionRelease | null;
  };
  transport: { terminalOrigins: string[] };
}

interface ResolveAppConfigInput {
  env: Record<string, string | undefined>;
  defaultExtensionReleaseRef?: string;
}

const resolveEventBufferSize = (value: string | undefined) => {
  if (!value) return DEFAULT_EVENT_BUFFER_SIZE;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_EVENT_BUFFER_SIZE;
  return Math.floor(parsed);
};

const resolveAutomationRunsPerMinute = (value: string | undefined) => {
  if (!value) return DEFAULT_AUTOMATION_RUNS_PER_MINUTE;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_AUTOMATION_RUNS_PER_MINUTE;
  return Math.floor(parsed);
};

const resolvePath = (configured: string | undefined, fallback: string, home: string | undefined) =>
  configured ? expandHomePath(configured, home) : fallback;

const resolveRelease = (input: ResolveAppConfigInput): ExtensionRelease | null => {
  const ref = (input.env.PSTDIO_EXTENSION_RELEASE_REF ?? input.defaultExtensionReleaseRef)?.trim() || undefined;
  const root = input.env.PSTDIO_EXTENSION_SOURCE_ROOT?.trim() || undefined;

  if (root && !ref) {
    throw new Error("PSTDIO_EXTENSION_SOURCE_ROOT requires PSTDIO_EXTENSION_RELEASE_REF");
  }
  if (root && ref) return { source: "workspace", ref, root };
  if (ref) return { source: "git", ref };
  return null;
};

export const resolveAppConfig = (input: ResolveAppConfigInput): AppConfig => {
  const home = input.env.HOME?.trim() || undefined;
  return {
    database: {
      path: resolvePath(input.env.PSTDIO_DB_PATH, resolvePstdioDbPath({ env: input.env }), home),
    },
    storage: {
      root: resolvePath(input.env.PSTDIO_STORAGE_PATH, resolvePstdioStoragePath({ env: input.env }), home),
    },
    sync: { eventBufferSize: resolveEventBufferSize(input.env.PSTDIO_EVENT_BUS_BUFFER_SIZE) },
    automation: {
      runsPerMinute: resolveAutomationRunsPerMinute(input.env.PSTDIO_AUTOMATION_RUNS_PER_MINUTE),
    },
    extensions: {
      buildWebviews: input.env.PSTDIO_EXTENSION_WEBVIEW_BUILDS !== "0",
      release: resolveRelease(input),
    },
    transport: {
      terminalOrigins:
        input.env.PSTDIO_TERMINAL_ORIGINS?.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean) ?? [],
    },
  };
};
