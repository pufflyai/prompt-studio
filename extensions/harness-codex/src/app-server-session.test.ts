import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { JsonPatch, SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import type { SpawnDeps } from "./codex-process";
import { createCodexRuntime } from "./codex-runtime";
import type { ResumeSpawnInput, StartSpawnInput } from "./session-input";

let runtime: ReturnType<typeof createCodexRuntime>;
const startCodexSession = (input: StartSpawnInput, deps: SpawnDeps) => {
  runtime ??= createCodexRuntime(deps);
  return runtime.run(input);
};
const resumeCodexSession = (input: ResumeSpawnInput, deps: SpawnDeps) => startCodexSession(input, deps);

const transcriptRoots: string[] = [];
let transcriptPath: string;
let fixtureChild: ReturnType<typeof spawn>;
afterEach(async () => {
  await runtime?.dispose();
  runtime = undefined!;
  for (const root of transcriptRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const fixtureDeps: SpawnDeps = {
  spawnProcess: (_args, options) => {
    const root = mkdtempSync(join(tmpdir(), "codex question-"));
    transcriptRoots.push(root);
    transcriptPath = join(root, "rollout.jsonl");
    writeFileSync(transcriptPath, "");
    const fixtureUrl = pathToFileURL(join(root, "app-server-fixture.ts"));
    copyFileSync(new URL("./app-server-fixture.ts", import.meta.url), fixtureUrl);
    const child = spawn(process.execPath, [fileURLToPath(fixtureUrl)], {
      stdio: "pipe",
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env, PSTDIO_TEST_TRANSCRIPT: transcriptPath },
    });
    fixtureChild = child;
    return {
      stdin: child.stdin!,
      stdout: child.stdout!,
      stderr: child.stderr!,
      kill: () => {
        child.kill();
      },
      onExit: new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal }))),
    };
  },
};

test("fails the run when its final message cannot be published", async () => {
  const session = await startCodexSession(
    {
      prompt: "Complete",
      env: { PSTDIO_TEST_MODE: "complete" },
      events: {
        getMessages: () => [],
        push: (patch) => {
          const message = patch.value as SessionMessage;
          if (message.parts.some((part) => part.type === "text" && part.text === "Hi, colleague")) {
            throw new Error("Message storage failed");
          }
        },
      },
    },
    fixtureDeps,
  );
  try {
    expect(await session.done).toEqual({ status: "failed" });
  } finally {
    session.stop();
  }
});

test("keeps structured questions pending until an explicit correlated reply reaches the same process", async () => {
  const messages: SessionMessage[] = [];
  const events = {
    getMessages: () => messages,
    push: (patch: JsonPatch) => {
      messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
    },
  };
  const session = await startCodexSession({ prompt: "Ask first", events }, fixtureDeps);
  try {
    for (let i = 0; !messages.some((m) => m.parts.some((p) => p.type === "tool")) && i < 50; i++) await Bun.sleep(10);
    const question = messages.flatMap((m) => m.parts).find((p) => p.type === "tool") as ToolPart | undefined;
    expect(question).toMatchObject({ tool: "question", callId: "question-1", status: "pending" });
    expect(question?.state?.input).toMatchObject({
      questions: [
        {
          id: "greeting",
          header: "Greeting",
          allowCustomAnswer: true,
          options: [
            { label: "Hi", description: "An informal greeting." },
            { label: "Hello", description: "A formal greeting." },
          ],
        },
        { id: "audience", options: [], allowCustomAnswer: true },
      ],
    });
    expect(session.replyQuestion).toBeDefined();
    await expect(session.replyQuestion!({ callId: "expired", answers: [["Hi"], ["colleague"]] })).rejects.toThrow(
      "no longer pending",
    );
    expect(question?.status).toBe("pending");
    await session.replyQuestion!({ callId: "question-1", answers: [["Hi"], ["colleague"]] });
    expect(readFileSync(transcriptPath, "utf8")).toContain('"function_call_output"');
    expect(await session.done).toEqual({ status: "completed" });
    const answered = messages.flatMap((m) => m.parts).find((p) => p.type === "tool") as ToolPart;
    expect(answered.status).toBe("completed");
    expect(answered.state?.output).toContain("colleague");
    expect(messages.some((m) => m.parts.some((p) => p.type === "text" && p.text === "Hi, colleague"))).toBe(true);
    await expect(session.replyQuestion!({ callId: "question-1", answers: [["Hi"], ["colleague"]] })).rejects.toThrow(
      "no longer pending",
    );
  } finally {
    await session.stop();
  }
});

test("skips a native question through its correlated live request", async () => {
  const messages: SessionMessage[] = [];
  const session = await startCodexSession(
    {
      prompt: "Ask first",
      env: { PSTDIO_TEST_MODE: "skip" },
      events: {
        getMessages: () => messages,
        push: (patch) => {
          messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
        },
      },
    },
    fixtureDeps,
  );
  try {
    for (let i = 0; !messages.some((m) => m.parts.some((p) => p.type === "tool")) && i < 50; i++) await Bun.sleep(10);
    await session.replyQuestion!({ callId: "question-1", answers: [] });
    expect(await session.done).toEqual({ status: "completed" });
    const record = JSON.parse(readFileSync(transcriptPath, "utf8").trim());
    expect(JSON.parse(record.payload.output)).toEqual({ answers: {} });
    expect(messages.flatMap((m) => m.parts).find((p) => p.type === "tool")).toMatchObject({
      callId: "question-1",
      status: "completed",
    });
    await expect(session.replyQuestion!({ callId: "question-1", answers: [] })).rejects.toThrow("no longer pending");
  } finally {
    session.stop();
    await session.done;
  }
});

for (const mode of ["cleared", "mismatch"]) {
  test(`rejects a ${mode} native request instead of reporting answer delivery`, async () => {
    const messages: SessionMessage[] = [];
    const session = await startCodexSession(
      {
        prompt: "Ask",
        env: { PSTDIO_TEST_MODE: mode },
        events: {
          getMessages: () => messages,
          push: (patch) => {
            messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
          },
        },
      },
      fixtureDeps,
    );
    try {
      for (let i = 0; !messages.some((m) => m.parts.some((p) => p.type === "tool")) && i < 50; i++) await Bun.sleep(10);
      await expect(session.replyQuestion!({ callId: "question-1", answers: [["Hi"], ["colleague"]] })).rejects.toThrow(
        "not accepted",
      );
      await session.done;
      expect(messages.flatMap((m) => m.parts).find((p) => p.type === "tool")).toMatchObject({ status: "failed" });
    } finally {
      session.stop();
      await session.done;
    }
  });
}

test("resumes the native thread with model, effort, attachments, environment, and message offset", async () => {
  const cwd = tmpdir();
  const localPath = join(cwd, "notes.txt");
  const patches: JsonPatch[] = [];
  const events = {
    getMessages: () => [],
    push: (patch: JsonPatch) => {
      patches.push(patch);
    },
  };
  const session = await resumeCodexSession(
    {
      agentSessionId: "thread-fixture",
      prompt: "Read the attachment",
      model: "gpt-5.5",
      params: { model_reasoning_effort: "high" },
      cwd,
      env: { PSTDIO_TEST_MODE: "complete" },
      messageOffset: 5,
      events,
      attachments: [
        {
          fileId: "file-1",
          fileName: "notes.txt",
          localPath,
          mimeType: "text/plain",
          sizeBytes: 4,
          url: "/files/file-1",
        },
      ],
    },
    fixtureDeps,
  );
  expect(session.agentSessionId).toBe("thread-fixture");
  expect(await session.done).toEqual({ status: "completed" });
  expect(patches[0]).toMatchObject({
    path: "/messages/5",
    value: {
      role: "user",
      parts: [
        { type: "text", text: "Read the attachment" },
        { type: "file", fileId: "file-1" },
      ],
    },
  });
  const texts = patches
    .flatMap((p) => (p.value as SessionMessage).parts)
    .filter((p) => p.type === "text")
    .map((p) => p.text);
  expect(JSON.parse(texts[1])).toMatchObject({ threadId: "thread-fixture", model: "gpt-5.5", effort: "high" });
  expect(JSON.parse(texts[1]).input[0].text).toContain(`path=${JSON.stringify(localPath)}`);
});

test("cancels a pending native question and rejects later replies", async () => {
  const session = await startCodexSession(
    { prompt: "Ask", events: { getMessages: () => [], push: () => {} } },
    fixtureDeps,
  );
  session.stop();
  expect(await session.done).toEqual({ status: "cancelled" });
  await expect(session.replyQuestion!({ callId: "question-1", answers: [["Hi"], ["colleague"]] })).rejects.toThrow(
    "no longer pending",
  );
});

test("reports a provider failure and rejects a question reply after its process is gone", async () => {
  const session = await startCodexSession(
    { prompt: "Fail", env: { PSTDIO_TEST_MODE: "fail" }, events: { getMessages: () => [], push: () => {} } },
    fixtureDeps,
  );
  expect(await session.done).toEqual({ status: "failed" });
  await expect(
    resumeCodexSession(
      {
        agentSessionId: "thread-fixture",
        prompt: "Hi",
        questionResponse: { callId: "old-request", answers: [["Hi"]] },
        events: { getMessages: () => [], push: () => {} },
      },
      fixtureDeps,
    ),
  ).rejects.toThrow("no longer pending");
});

test("fails and releases a provider that exits successfully without completing its turn", async () => {
  const session = await startCodexSession(
    { prompt: "Close", env: { PSTDIO_TEST_MODE: "close" }, events: { getMessages: () => [], push: () => {} } },
    fixtureDeps,
  );
  try {
    expect(await Promise.race([session.done, Bun.sleep(500).then(() => null)])).toEqual({ status: "disconnected" });
  } finally {
    session.stop();
    await session.done;
  }
});

test("reports disconnection for unreadable native events received before turn acknowledgement", async () => {
  const session = await startCodexSession(
    {
      prompt: "Fail protocol",
      env: { PSTDIO_SESSION_ID: "protocol-recovery", PSTDIO_TEST_MODE: "protocol-error" },
      events: { getMessages: () => [], push: () => {} },
    },
    fixtureDeps,
  );
  expect(await session.done).toEqual({ status: "disconnected" });
  expect(session.agentSessionId).toBe("thread-fixture");
  const followUp = await resumeCodexSession(
    {
      agentSessionId: session.agentSessionId,
      prompt: "Continue",
      env: { PSTDIO_SESSION_ID: "protocol-recovery", PSTDIO_TEST_MODE: "complete" },
      events: { getMessages: () => [], push: () => {} },
    },
    fixtureDeps,
  );
  expect(await followUp.done).toEqual({ status: "completed" });
  expect(followUp.agentSessionId).toBe(session.agentSessionId);
});

test("releases the live run when its protocol stream reports an error", async () => {
  const session = await startCodexSession(
    { prompt: "Ask", events: { getMessages: () => [], push: () => {} } },
    fixtureDeps,
  );
  try {
    fixtureChild.stdout!.destroy(new Error("Protocol read failed"));
    expect(await Promise.race([session.done, Bun.sleep(500).then(() => null)])).toEqual({ status: "disconnected" });
  } finally {
    session.stop();
    await session.done;
  }
});
