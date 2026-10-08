import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

test("the Codex fixture acknowledges the started turn before publishing its completion", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-fixture-turn-"));
  const child = spawn(process.execPath, [`${import.meta.dir}/sessions-create-codex.fixture.ts`], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, CODEX_E2E_PROMPTS: join(root, "prompts.log") },
  });
  const exited = once(child, "exit");
  const replies = createInterface({ input: child.stdout });
  try {
    const started = once(replies, "line");
    child.stdin.write(
      `${JSON.stringify({ id: 1, method: "turn/start", params: { input: [{ type: "text", text: "Inspect" }] } })}\n`,
    );
    expect(JSON.parse((await started)[0])).toMatchObject({ id: 1, result: { turn: { id: "turn-e2e" } } });
  } finally {
    replies.close();
    child.stdin.end();
    expect((await exited)[0]).toBe(0);
    rmSync(root, { recursive: true, force: true });
  }
});

test("the Codex fixture answers model discovery before a session starts", async () => {
  const child = spawn(process.execPath, [`${import.meta.dir}/sessions-create-codex.fixture.ts`], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  const exited = once(child, "exit");
  const replies = createInterface({ input: child.stdout });
  try {
    const initialized = once(replies, "line");
    child.stdin.write(`${JSON.stringify({ id: 0, method: "initialize", params: {} })}\n`);
    expect(JSON.parse((await initialized)[0])).toMatchObject({ id: 0, result: {} });

    const listed = once(replies, "line");
    child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
    child.stdin.write(`${JSON.stringify({ id: 1, method: "model/list", params: {} })}\n`);
    expect(JSON.parse((await listed)[0])).toMatchObject({ id: 1, result: { data: [{ id: "gpt-5.5" }] } });
  } finally {
    replies.close();
    child.stdin.end();
    expect((await exited)[0]).toBe(0);
  }
});
