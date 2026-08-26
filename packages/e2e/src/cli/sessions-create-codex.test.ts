import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { FLOW_TIMEOUT, SETUP_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const dirs: string[] = [];
let promptLogPath = "";

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

const createCodexBinary = () => {
  const binDir = join(tmpdir(), `pstdio-e2e-codex-bin-${crypto.randomUUID()}`);
  mkdirSync(binDir, { recursive: true });
  dirs.push(binDir);

  const codexPath = join(binDir, "codex");
  writeFileSync(
    codexPath,
    [
      "#!/bin/sh",
      'if [ "$1" = "--version" ]; then',
      '  echo "codex-cli 0.0.0"',
      "  exit 0",
      "fi",
      'if [ "$1" = "exec" ]; then',
      "  prompt=$(cat)",
      "  {",
      '    echo "---PROMPT---"',
      '    printf "%s\\n" "$prompt"',
      '  } >> "$CODEX_E2E_PROMPTS"',
      '  echo \'{"type":"thread.started","thread_id":"codex-e2e-thread"}\'',
      '  echo \'{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"done"}}\'',
      '  echo \'{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1}}\'',
      "  exit 0",
      "fi",
      'echo "unexpected codex command: $*" >&2',
      "exit 1",
      "",
    ].join("\n"),
  );
  chmodSync(codexPath, 0o755);

  return binDir;
};

const waitForCompletedSession = async (sessionId: string) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const res = await fetch(`${api.url}/v1/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const session = (await res.json()) as { status: string };

    if (session.status === "completed") return;
    if (session.status === "failed") throw new Error(`Codex session ${sessionId} failed`);

    await Bun.sleep(100);
  }

  throw new Error(`Codex session ${sessionId} did not complete`);
};

beforeAll(async () => {
  const binDir = createCodexBinary();
  promptLogPath = join(tmpdir(), `pstdio-e2e-codex-prompts-${crypto.randomUUID()}.log`);
  api = await startApi({
    env: {
      CODEX_E2E_PROMPTS: promptLogPath,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    },
  });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

describe("pstdio sessions create with mocked Codex", () => {
  test(
    "uploads an attachment and sends Codex a local attachment manifest",
    async () => {
      const repo = createInitializedRepo("external-codex-attachment-session");
      writeFileSync(join(repo, "notes.txt"), "codex attachment context\n");

      const result = runSafe(
        'sessions create --agent pstdio.harness-codex.harness.codex --model gpt-5.5 --prompt "Inspect the attachment" --attach notes.txt',
        repo,
        FLOW_TIMEOUT,
      );

      if (result.exitCode !== 0) {
        throw new Error(
          `sessions create exited with ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
        );
      }
      const createdSessionId = result.stdout.match(/Created session (\S+)/)?.[1];
      if (!createdSessionId) throw new Error(`Session id missing from CLI output: ${result.stdout}`);

      await waitForCompletedSession(createdSessionId);

      const promptLog = readFileSync(promptLogPath, "utf8");
      expect(promptLog).toContain("Inspect the attachment");
      expect(promptLog).toContain("<session-attachments>");
      expect(promptLog).toContain("notes.txt");
      expect(promptLog).toContain("text/plain");
      expect(promptLog).toContain("path=");

      const conversationRes = await fetch(`${api.url}/v1/sessions/${createdSessionId}/conversation`);
      expect(conversationRes.status).toBe(200);
      const conversation = (await conversationRes.json()) as { messages: Array<{ parts: unknown[] }> };
      expect(conversation.messages[0]?.parts).toContainEqual(
        expect.objectContaining({ type: "file", filename: "notes.txt" }),
      );
    },
    FLOW_TIMEOUT,
  );
});
