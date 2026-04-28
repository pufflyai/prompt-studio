import { describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JsonPatch, SessionMessage } from "pstdio-agents";

const HARNESS = process.env.PSTDIO_HARNESS_UNDER_TEST;
const INSTALL_METHOD = process.env.PSTDIO_INSTALL_METHOD ?? "unknown";
const TEST_TIMEOUT_MS = 45_000;
const OUTPUT_WAIT_MS = 30_000;

const createCandidatePort = () => 43_000 + Math.floor(Math.random() * 200);

type SSEEvent = {
  event: string;
  data: unknown;
};

const parseSSEBlock = (block: string): SSEEvent | null => {
  if (!block.trim()) return null;

  let event = "message";
  let data = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data = line.slice(5).trim();
  }

  return data ? { event, data: JSON.parse(data) } : null;
};

const hasHarnessOutput = (message: SessionMessage) => {
  if (message.role === "user") return false;
  return message.parts.some((part) => part.type !== "loading");
};

const getPatchMessages = (patch: JsonPatch) => {
  if (patch.path === "/messages" && Array.isArray(patch.value)) {
    return patch.value.filter((value): value is SessionMessage => typeof value === "object" && value !== null);
  }

  if (patch.path.startsWith("/messages/") && patch.value && typeof patch.value === "object") {
    return [patch.value as SessionMessage];
  }

  return [];
};

const waitForReady = async (baseUrl: string, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`pstdio serve did not become ready within ${timeoutMs}ms`);
};

const stopProcess = async (child: ChildProcess) => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
};

const startServer = async (cwd: string) => {
  const firstPort = createCandidatePort();
  let startupError: unknown = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const port = firstPort + attempt;
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn("pstdio", ["serve", "--port", String(port)], {
      cwd,
      env: {
        ...process.env,
        PSTDIO_API_PORT: String(port),
      },
      stdio: "pipe",
    });

    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    try {
      await waitForReady(baseUrl);
      return { child, baseUrl };
    } catch (error) {
      startupError = new Error(`startup attempt failed (${attempt + 1}): ${String(error)}\n${stderr}`.trim());
      await stopProcess(child);
    }
  }

  throw startupError instanceof Error ? startupError : new Error(String(startupError));
};

const createProject = async (baseUrl: string) => {
  const res = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `harness-smoke-${Date.now()}` }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
};

const cancelSession = async (baseUrl: string, sessionId: string) => {
  await fetch(`${baseUrl}/v1/sessions/${sessionId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  }).catch(() => undefined);
};

const setupDefaultAgent = async (baseUrl: string, harness: string) => {
  const res = await fetch(`${baseUrl}/v1/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent_id: harness }),
  });
  expect(res.status).toBe(201);
};

const requireAgentAvailable = async (baseUrl: string, harness: string) => {
  const res = await fetch(`${baseUrl}/v1/agents/availability?agent=${encodeURIComponent(harness)}`);
  expect(res.status).toBe(200);
  const availability = (await res.json()) as { type: string };
  expect(availability.type).toBe("INSTALLED");
};

const startSession = async (baseUrl: string, projectId: string, harness: string) => {
  const res = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      title: `harness-connect-${harness}`,
      prompt: "hi",
      agent: harness,
    }),
  });

  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
};

const waitForHarnessOutput = async (baseUrl: string, sessionId: string, timeoutMs = OUTPUT_WAIT_MS) => {
  const response = await fetch(`${baseUrl}/v1/sessions/${sessionId}/stream`);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to open stream for session ${sessionId}. HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let buffer = "";

  while (Date.now() < deadline) {
    const next = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 1000)),
    ]).catch(() => ({ done: false, value: undefined }));

    if (next.done) break;
    if (next.value) {
      buffer += decoder.decode(next.value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseSSEBlock(block);
        if (!parsed || parsed.event !== "patch") continue;

        const patch = parsed.data as JsonPatch;
        const messages = getPatchMessages(patch);

        if (messages.some(hasHarnessOutput)) {
          reader.cancel();
          return;
        }
      }
    }
  }

  reader.cancel();
  throw new Error(`No harness stdout/stderr observed within ${timeoutMs}ms (${INSTALL_METHOD})`);
};

const runSmoke = HARNESS === "claude-code" || HARNESS === "opencode";

describe("packaged harness connect smoke", () => {
  test.if(runSmoke)(
    "marks harness available and receives process output after starting a session",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-harness-smoke-"));
      let server: { child: ChildProcess; baseUrl: string } | null = null;
      let sessionId: string | null = null;

      try {
        server = await startServer(tempRoot);
        await requireAgentAvailable(server.baseUrl, HARNESS!);
        await setupDefaultAgent(server.baseUrl, HARNESS!);
        const project = await createProject(server.baseUrl);
        const session = await startSession(server.baseUrl, project.id, HARNESS!);
        sessionId = session.id;
        await waitForHarnessOutput(server.baseUrl, session.id);
      } finally {
        if (server && sessionId) {
          await cancelSession(server.baseUrl, sessionId);
        }
        if (server) await stopProcess(server.child);
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT_MS,
  );
});
