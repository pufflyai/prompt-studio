import { spawn } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

export type OpencodeFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type OpencodeServerStarter = (options: { host: string; port: number }) => Promise<string>;

export type OpencodeServerStore = {
  read: () => Promise<string | null>;
  write: (url: string) => Promise<void>;
  clear: () => Promise<void>;
};

export type OpencodeModelInput = {
  providerID: string;
  modelID: string;
};

const GET_TIMEOUT_MS = 15_000;
const POST_TIMEOUT_MS = 300_000;

export const defaultServerHost = "127.0.0.1";
export const defaultServerPort = 4096;
export const maxServerPortAttempts = 20;

const resolveHome = () => process.env.HOME ?? process.env.USERPROFILE ?? homedir();

export const defaultServerStorePath = () => join(resolveHome(), ".pstdio", "opencode-server.txt");

export const buildServerUrl = (host: string, port: number) => `http://${host}:${port}`;

export const buildRequestUrl = (baseUrl: string, path: string, directory: string) => {
  const url = new URL(path, baseUrl);
  url.searchParams.set("directory", directory);
  return url.toString();
};

export const buildHeaders = (directory: string) => ({
  "content-type": "application/json",
  "x-opencode-directory": directory,
});

const parseJsonValue = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

export const toOpencodeModelInput = (model?: string | null) => {
  const trimmedModel = model?.trim();
  if (!trimmedModel) return undefined;

  const slashIndex = trimmedModel.indexOf("/");
  if (slashIndex <= 0 || slashIndex === trimmedModel.length - 1) return undefined;

  const providerID = trimmedModel.slice(0, slashIndex).trim();
  const modelID = trimmedModel.slice(slashIndex + 1).trim();

  if (!providerID || !modelID) return undefined;

  return { providerID, modelID } satisfies OpencodeModelInput;
};

export const isTransportTimeout = (error: unknown) =>
  error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");

export const isConnectionError = (error: unknown) => {
  if (isTransportTimeout(error)) return false;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  if (message.includes("fetch failed")) return true;
  if (message.includes("econnrefused")) return true;
  if (message.includes("econnreset")) return true;

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const code = (cause as { code?: unknown }).code;
    if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOTFOUND") return true;
  }

  return false;
};

export const requestJson = async <T>(
  fetcher: OpencodeFetcher,
  url: string,
  options: { method: string; headers: Record<string, string>; body?: unknown },
) => {
  const timeoutMs = options.method === "GET" ? GET_TIMEOUT_MS : POST_TIMEOUT_MS;

  const response = await fetcher(url, {
    method: options.method,
    headers: options.headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  const parsed = text.trim() ? (parseJsonValue(text) as T | null) : null;

  return { response, text, parsed };
};

export const requireResponseOk = (response: Response, text: string, message: string) => {
  if (response.ok) return;

  const suffix = text.trim() ? ` ${text.trim()}` : "";
  throw new Error(`${message}: HTTP ${response.status}${suffix}`);
};

export const parsePromptResponse = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return;

  const parsed = parseJsonValue(trimmed);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`OpenCode session.prompt returned unexpected response: ${trimmed}`);
  }

  const record = parsed as Record<string, unknown>;

  if (record.info && record.parts) return;

  if (typeof record.name === "string") {
    const data = record.data as { message?: string } | undefined;
    const message = data?.message ?? trimmed;
    throw new Error(`OpenCode session.prompt failed: ${record.name}: ${message}`);
  }

  throw new Error(`OpenCode session.prompt returned unexpected response: ${trimmed}`);
};

export const createFileServerStore = (path: string): OpencodeServerStore => ({
  read: async () => {
    try {
      const raw = await readFile(path, "utf8");
      const value = raw.trim();
      return value.length > 0 ? value : null;
    } catch {
      return null;
    }
  },
  write: async (url: string) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${url}\n`, "utf8");
  },
  clear: async () => {
    try {
      await unlink(path);
    } catch {
      return;
    }
  },
});

export const canConnectToHost = ({ host, port }: { host: string; port: number }) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host, port });

    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });

export const defaultPingServer = async (url: string) => {
  try {
    const healthUrl = new URL("/global/health", url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 750);

    try {
      const response = await fetch(healthUrl, { signal: controller.signal });
      if (!response.ok) return false;

      const payload = (await response.json()) as { healthy?: boolean } | null;
      return payload?.healthy === true;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
};

const readServerUrl = (output: string) => {
  const trimmed = output.trim();
  if (!trimmed) return null;

  const prefix = "opencode server listening on ";
  if (trimmed.startsWith(prefix)) {
    return trimmed.slice(prefix.length).trim();
  }

  return null;
};

const waitForServerUrl = async (stdout: NodeJS.ReadableStream, stderr: NodeJS.ReadableStream) => {
  const reader = createInterface({ input: stdout });
  const errReader = createInterface({ input: stderr });
  let stderrTail = "";

  const collectError = (line: string) => {
    stderrTail = `${stderrTail}\n${line}`.trim().slice(-8000);
  };

  errReader.on("line", collectError);

  const url = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const suffix = stderrTail ? `\n${stderrTail}` : "";
      reject(new Error(`Timed out waiting for Opencode server URL.${suffix}`));
    }, 120_000);

    reader.on("line", (line) => {
      const parsed = readServerUrl(line);
      if (parsed) {
        clearTimeout(timeout);
        resolve(parsed);
      }
    });

    reader.once("close", () => {
      clearTimeout(timeout);
      const suffix = stderrTail ? `\n${stderrTail}` : "";
      reject(new Error(`Opencode server exited before publishing its URL.${suffix}`));
    });
  });

  reader.close();
  errReader.close();

  return url;
};

export const defaultStartServer: OpencodeServerStarter = async ({ host, port }) => {
  const child = spawn("opencode", ["serve", "--hostname", host, "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const url = await new Promise<string>((resolve, reject) => {
      child.once("error", (error) => {
        reject(new Error(`Failed to start Opencode server: ${error.message}`));
      });

      if (!child.stdout || !child.stderr) {
        reject(new Error("Opencode server missing stdout/stderr streams."));
        return;
      }

      waitForServerUrl(child.stdout, child.stderr).then(resolve).catch(reject);
    });

    return url;
  } catch (error) {
    child.kill();
    throw error;
  }
};
