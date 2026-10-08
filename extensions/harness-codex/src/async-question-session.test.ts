import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import type { JsonPatch, SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { resumeCodexSession, type SpawnDeps, startCodexSession } from "./spawn";

const children: ReturnType<typeof spawn>[] = [];
afterEach(() => {
  for (const child of children.splice(0)) child.kill();
});
const deps: SpawnDeps = {
  spawnProcess: (_args, options) => {
    const child = spawn(process.execPath, [new URL("./app-server-fixture.ts", import.meta.url).pathname], {
      stdio: "pipe",
      env: { ...process.env, ...options?.env, PSTDIO_TEST_MODE: options?.env?.PSTDIO_TEST_MODE ?? "async" },
    });
    children.push(child);
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
const sink = (messages: SessionMessage[] = []) => ({
  getMessages: () => messages,
  push: (patch: JsonPatch) => {
    messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
  },
});
const findQuestion = (messages: readonly SessionMessage[]) =>
  messages.flatMap((m) => m.parts).find((p) => p.type === "tool" && p.tool === "question") as ToolPart | undefined;
const waitForQuestion = async (events: ReturnType<typeof sink>) => {
  for (let i = 0; !findQuestion(events.getMessages()) && i < 50; i++) await Bun.sleep(10);
  expect(findQuestion(events.getMessages())).toMatchObject({ callId: "async-1", status: "pending" });
};

test("steers a Unicode async answer to the active turn and rejects duplicate submissions", async () => {
  const events = sink();
  const session = await startCodexSession({ prompt: "Ask asynchronously", events }, deps);
  try {
    await waitForQuestion(events);
    await expect(session.replyQuestion!({ callId: "async-1", answers: [["Hi"]] })).rejects.toThrow("Answer every");
    const response = { callId: "async-1", answers: [["Hi"], ["Åsa and the café team"]] };
    const sending = session.replyQuestion!(response);
    await expect(session.replyQuestion!(response)).rejects.toThrow("no longer pending");
    await sending;
    expect(findQuestion(events.getMessages())).toMatchObject({
      status: "completed",
      state: { output: { answers: response.answers } },
    });
    expect(await session.done).toEqual({ status: "completed" });
    const steer = events
      .getMessages()
      .flatMap((m) => m.parts)
      .find((p) => p.type === "text" && p.text?.includes('"expectedTurnId"'));
    expect(steer?.type === "text" && JSON.parse(steer.text!)).toMatchObject({
      method: "turn/steer",
      params: { threadId: "thread-fixture", expectedTurnId: "turn-1" },
    });
    expect(steer?.type === "text" && steer.text).toContain("Åsa and the café team");
  } finally {
    session.stop();
    await session.done;
  }
});

for (const answers of [[["Hello"], ["colleague"]], []]) {
  test(`answers a recovered async question in a resumed turn (${answers.length ? "answer" : "skip"})`, async () => {
    const events = sink();
    const first = await startCodexSession(
      { prompt: "Ask asynchronously", env: { PSTDIO_TEST_MODE: "async-complete" }, events },
      deps,
    );
    await first.done;
    expect(findQuestion(events.getMessages())?.status).toBe("pending");
    const session = await resumeCodexSession(
      {
        agentSessionId: first.agentSessionId!,
        prompt: "Answer",
        questionResponse: { callId: "async-1", answers },
        messageOffset: events.getMessages().length,
        env: { PSTDIO_TEST_MODE: "complete" },
        events,
      },
      deps,
    );
    await session.done;
    expect(findQuestion(events.getMessages())).toMatchObject({ status: "completed", state: { output: { answers } } });
    await expect(
      resumeCodexSession(
        {
          agentSessionId: first.agentSessionId!,
          prompt: "Repeat",
          questionResponse: { callId: "async-1", answers },
          events,
        },
        deps,
      ),
    ).rejects.toThrow("no longer pending");
  });
}

test("leaves an async question pending when the provider rejects steering", async () => {
  const events = sink();
  const session = await startCodexSession({ prompt: "Ask", env: { PSTDIO_TEST_MODE: "async-reject" }, events }, deps);
  try {
    await waitForQuestion(events);
    await expect(session.replyQuestion!({ callId: "async-1", answers: [] })).rejects.toThrow("Steer rejected");
    expect(findQuestion(events.getMessages())?.status).toBe("pending");
  } finally {
    session.stop();
    await session.done;
  }
});
