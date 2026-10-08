import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { HarnessStateApi, JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";
import { codexCommandInput } from "./command-input";
import { approvedPlanKey, codexProposedPlan, prepareCodexPlanApproval, readCodexProposedPlan } from "./plan-approval";
import type { Turn } from "./protocol/v2/Turn";

const turn = (id: string, text = "Build the feature", status = "completed") =>
  ({
    id,
    status,
    items: [{ type: "plan", id: "proposal", text }],
  }) as Turn;
test("only completed native proposals become approval decisions", () => {
  expect(codexProposedPlan([turn("old"), turn("latest", "Build the agreed feature")])).toEqual({
    id: "latest/proposal",
    text: "Build the agreed feature",
  });
  expect(codexProposedPlan([turn("pending", "Draft", "inProgress")])).toBeUndefined();
  expect(codexProposedPlan([turn("failed", "Draft", "failed")])).toBeUndefined();
  expect(codexProposedPlan([turn("empty", "")])).toBeUndefined();
  expect(codexProposedPlan([turn("old"), { ...turn("follow-up"), items: [] }])).toEqual({
    id: "old/proposal",
    text: "Build the feature",
  });
});

const runtimes: ReturnType<typeof createCodexRuntime>[] = [];
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose();
});
const fixtureRuntime = (mode = "plan-approval", onReadBlocked?: () => void) => {
  const runtime = createCodexRuntime({
    spawnProcess: () => {
      const child = spawn(process.execPath, [fileURLToPath(new URL("./app-server-fixture.ts", import.meta.url))], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PSTDIO_TEST_MODE: mode, BUN_BE_BUN: "1" },
      });
      child.stdout?.on("data", (chunk) => {
        if (String(chunk).includes("fixture/read-blocked")) onReadBlocked?.();
      });
      return {
        stdin: child.stdin!,
        stdout: child.stdout!,
        stderr: child.stderr!,
        kill: () => {
          child.kill();
        },
        onExit: new Promise<{ code: number | null; signal: string | null }>((resolve) =>
          child.once("exit", (code, signal) => resolve({ code, signal })),
        ),
      };
    },
  });
  runtimes.push(runtime);
  return runtime;
};
const memoryState = () => {
  const values = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    set: async <T>(key: string, value: T) => {
      values.set(key, value);
    },
    delete: async (key: string) => {
      values.delete(key);
    },
  } satisfies HarnessStateApi;
};
const input = {
  sessionId: "one",
  agentSessionId: "thread-fixture",
  model: "fixture",
  params: { collaboration_mode: "plan" },
};
const events = { getMessages: () => [], push: () => {} };
test("approval exits planning and starts implementation in the same native thread", async () => {
  const state = memoryState();
  const runtime = fixtureRuntime();
  const messages: SessionMessage[] = [];
  const capturedEvents = {
    getMessages: () => messages,
    push: (patch: JsonPatch) => {
      messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
    },
  };
  const result = await prepareCodexPlanApproval(input, "plan-turn/proposal", runtime, { state }).invoke({
    events: capturedEvents,
  });
  expect(result.params).toEqual({ collaboration_mode: "default" });
  expect(result.session.agentSessionId).toBe("thread-fixture");
  expect(await result.session.done).toEqual({ status: "completed" });
  const texts = messages
    .flatMap((message) => message.parts)
    .flatMap((part) => (part.type === "text" ? [part.text] : []));
  const nativeInput = texts
    .map((text) => {
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    })
    .find((value) => value?.input);
  expect(nativeInput).toMatchObject({
    threadId: "thread-fixture",
    collaborationMode: { mode: "default" },
    input: [{ type: "text", text: "Implement the approved plan." }],
  });
  expect(await state.get<string>(approvedPlanKey("thread-fixture"))).toBe("plan-turn/proposal");
  expect(
    await readCodexProposedPlan(
      runtime.worker(codexCommandInput(input, events)).request,
      "thread-fixture",
      "plan-turn/proposal",
    ),
  ).toBeUndefined();
});
test("approval rejects a stale native revision without recording approval", async () => {
  const state = memoryState();
  const prepared = prepareCodexPlanApproval(input, "old/proposal", fixtureRuntime(), { state });
  await expect(prepared.invoke({ events })).rejects.toThrow("The plan changed");
  expect(await state.get(approvedPlanKey("thread-fixture"))).toBeUndefined();
});
test("a definite native startup rejection keeps the proposal awaiting approval", async () => {
  const state = memoryState();
  const runtime = fixtureRuntime("plan-approval-rejected");
  const approval = prepareCodexPlanApproval(input, "plan-turn/proposal", runtime, { state });
  await expect(approval.invoke({ events })).rejects.toThrow("Implementation was rejected");
  expect(await state.get<string>(approvedPlanKey("thread-fixture"))).toBeUndefined();
  expect(
    await readCodexProposedPlan(runtime.worker(codexCommandInput(input, events)).request, "thread-fixture"),
  ).toMatchObject({ id: "plan-turn/proposal" });
});
test("a lost approval acknowledgement keeps the decision consumed without replay", async () => {
  const state = memoryState();
  const runtime = fixtureRuntime("plan-approval-lost-ack");
  const result = await prepareCodexPlanApproval(input, "plan-turn/proposal", runtime, { state }).invoke({ events });
  expect(["failed", "disconnected"]).toContain((await result.session.done).status);
  expect(await state.get<string>(approvedPlanKey("thread-fixture"))).toBe("plan-turn/proposal");
});
test("cancelling stalled approval readback releases the operation without consuming the plan", async () => {
  const state = memoryState();
  const readBlocked = Promise.withResolvers<void>();
  const runtime = fixtureRuntime("plan-approval-stalled", readBlocked.resolve);
  const controller = new AbortController();
  const pending = prepareCodexPlanApproval(input, "plan-turn/proposal", runtime, { state })
    .invoke({ events, signal: controller.signal })
    .then(
      () => "started",
      () => "cancelled",
    );
  await readBlocked.promise;
  const worker = runtime.worker(codexCommandInput(input, events));
  await worker.request("thread/goal/get", { threadId: "thread-fixture" });
  controller.abort();
  expect(await Promise.race([pending, Bun.sleep(100).then(() => "still pending")])).toBe("cancelled");
  expect(await state.get<string>(approvedPlanKey("thread-fixture"))).toBeUndefined();
  expect(worker.isClosed()).toBe(true);
});
