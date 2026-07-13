import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, getFreePort, startApi } from "./start-api";
import { FLOW_TIMEOUT, SETUP_TIMEOUT } from "./timeouts";

type OpencodeRequest = {
  type: "session.create" | "session.message";
  directory: string | null;
  body: unknown;
};

type SessionResponse = {
  id: string;
  status: string;
  agent: string | null;
  last_selected_model: string | null;
  agent_session_id: string | null;
};

let api: ApiInstance;
let opencodeServer: ReturnType<typeof Bun.serve>;
const dirs: string[] = [];
const opencodeRequests: OpencodeRequest[] = [];
const sessionId = "opencode-e2e-session";

const run = (args: string, cwd: string, timeout?: number) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url }, timeout);

const runSafe = (args: string, cwd: string, timeout?: number) =>
  runPstdioSafe(args, cwd, { PSTDIO_API_URL: api.url }, timeout);

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  execSync("git commit --allow-empty -m init", { cwd: repo, stdio: "pipe" });
  run(`projects create ${name}`, repo, FLOW_TIMEOUT);
  return repo;
};

const readProjectId = (repo: string) => {
  const configPath = join(repo, ".pstdio", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string };
  return config.project_id;
};

// This is a hermetic OpenCode binary stub. It only supports the discovery
// commands pstdio needs for availability/model listing and fails every other
// invocation, so CI cannot accidentally launch a real token-backed provider.
const createOpencodeBinary = () => {
  const binDir = join(tmpdir(), `pstdio-e2e-opencode-bin-${crypto.randomUUID()}`);
  mkdirSync(binDir, { recursive: true });
  dirs.push(binDir);

  const opencodePath = join(binDir, "opencode");
  writeFileSync(
    opencodePath,
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then',
      '  echo "opencode 0.0.0"',
      "  exit 0",
      "fi",
      'if [ "$1" = "models" ]; then',
      '  echo \'[{"id":"openai/gpt-5.5"},{"id":"openai/gpt-5.3-codex"}]\'',
      "  exit 0",
      "fi",
      'echo "unexpected opencode command: $*" >&2',
      "exit 1",
      "",
    ].join("\n"),
  );
  chmodSync(opencodePath, 0o755);

  return binDir;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isCreateModel = (body: unknown) => {
  if (!isRecord(body) || !isRecord(body.model)) return false;
  return body.model.providerID === "openai" && body.model.id === "gpt-5.5";
};

const isMessageModel = (body: unknown) => {
  if (!isRecord(body) || !isRecord(body.model)) return false;
  return body.model.providerID === "openai" && body.model.modelID === "gpt-5.5";
};

const invalidModelResponse = (body: unknown) =>
  new Response(JSON.stringify({ success: false, error: "invalid model payload", body }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const completedMessages = () => [
  {
    info: {
      id: "opencode-e2e-user",
      role: "user",
      sessionID: sessionId,
      time: { created: Date.now(), completed: Date.now() },
    },
    parts: [{ type: "text", text: "external repo session smoke" }],
  },
  {
    info: {
      id: "opencode-e2e-assistant",
      role: "assistant",
      sessionID: sessionId,
      modelID: "gpt-5.5",
      providerID: "openai",
      time: { created: Date.now(), completed: Date.now() },
    },
    parts: [{ type: "text", text: "done" }],
  },
];

// This is a protocol mock for the OpenCode HTTP server. The test exercises
// pstdio's OpenCode adapter payloads without starting OpenCode itself.
const startOpencodeServer = async () => {
  const port = await getFreePort();

  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/global/health") {
        return jsonResponse({ healthy: true });
      }

      if (url.pathname === "/session" && request.method === "POST") {
        const body = await request.json();
        opencodeRequests.push({ type: "session.create", directory: url.searchParams.get("directory"), body });

        if (!isCreateModel(body)) return invalidModelResponse(body);
        return jsonResponse({ id: sessionId });
      }

      if (url.pathname === `/session/${sessionId}/message` && request.method === "POST") {
        const body = await request.json();
        opencodeRequests.push({ type: "session.message", directory: url.searchParams.get("directory"), body });

        if (!isMessageModel(body)) return invalidModelResponse(body);
        return jsonResponse({ info: { id: "opencode-e2e-prompt" }, parts: [] });
      }

      if (url.pathname === `/session/${sessionId}/message` && request.method === "GET") {
        return jsonResponse(completedMessages());
      }

      return jsonResponse({ error: `Unexpected OpenCode request ${request.method} ${url.pathname}` }, 404);
    },
  });
};

const pointApiAtOpencodeServer = (url: string) => {
  const storeDir = join(api.homePath, ".pstdio");
  mkdirSync(storeDir, { recursive: true });
  writeFileSync(join(storeDir, "opencode-server.txt"), url);
};

const waitForCompletedSession = async (createdSessionId: string) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const res = await fetch(`${api.url}/v1/sessions/${createdSessionId}`);
    expect(res.status).toBe(200);
    const session = (await res.json()) as SessionResponse;

    if (session.status === "completed") return session;
    if (session.status === "failed") {
      throw new Error(`OpenCode session failed. Requests: ${JSON.stringify(opencodeRequests)}`);
    }

    await Bun.sleep(100);
  }

  throw new Error(`OpenCode session did not complete. Requests: ${JSON.stringify(opencodeRequests)}`);
};

beforeAll(async () => {
  const binDir = createOpencodeBinary();
  opencodeServer = await startOpencodeServer();
  api = await startApi({
    env: {
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    },
  });
  pointApiAtOpencodeServer(opencodeServer.url.toString());
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
  opencodeServer?.stop(true);
});

afterEach(() => {
  opencodeRequests.length = 0;
  cleanupDirs(dirs);
});

describe("pstdio sessions create with mocked OpenCode protocol", () => {
  test(
    "creates and completes a mocked OpenCode session from a non-prompt-studio repo with the selected model",
    async () => {
      const repo = createInitializedRepo("external-opencode-session");
      const repoPath = realpathSync(repo);
      const projectId = readProjectId(repo);

      const result = runSafe(
        'sessions create --agent pstdio.harness-open-code.opencode --model openai/gpt-5.5 --prompt "external repo session smoke"',
        repo,
        FLOW_TIMEOUT,
      );

      if (result.exitCode !== 0) {
        throw new Error(
          `sessions create exited with ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}\nopencodeRequests:\n${JSON.stringify(opencodeRequests, null, 2)}`,
        );
      }
      const createdSessionId = result.stdout.match(/Created session (\S+)/)?.[1];
      if (!createdSessionId) throw new Error(`Session id missing from CLI output: ${result.stdout}`);

      const session = await waitForCompletedSession(createdSessionId);
      expect(session.agent).toBe("pstdio.harness-open-code.opencode");
      expect(session.last_selected_model).toBe("openai/gpt-5.5");
      expect(session.agent_session_id).toBe(sessionId);

      expect(opencodeRequests).toEqual([
        {
          type: "session.create",
          directory: repoPath,
          body: { model: { providerID: "openai", id: "gpt-5.5" } },
        },
        {
          type: "session.message",
          directory: repoPath,
          body: {
            parts: [{ type: "text", text: "external repo session smoke" }],
            model: { providerID: "openai", modelID: "gpt-5.5" },
            variant: "medium",
          },
        },
      ]);

      const sessionsRes = await fetch(`${api.url}/v1/sessions?project_id=${encodeURIComponent(projectId)}`);
      const sessions = (await sessionsRes.json()) as Array<{ id: string }>;
      expect(sessions.some((s) => s.id === createdSessionId)).toBe(true);
    },
    FLOW_TIMEOUT,
  );
});
