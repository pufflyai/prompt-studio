import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { act } from "./actions";
import { commandIntent } from "./command-intent";
import { harnessConfirmationId } from "./harness-confirmation";
import { nativeAction } from "./native-actions";

const mode = {
  id: "plan",
  label: "Plan",
  description: "Current plan",
  state: "ready",
  actions: [{ id: "accept", label: "Implement plan" }],
  confirmation: { id: "revision-1", actionId: "accept", title: "Implement plan", model: "B" },
};
const state = {
  harnessId: "agent",
  commands: [{ name: "/goal", description: "Set a goal", composer: { label: "Goal", reservedArguments: ["clear"] } }],
  modes: [mode],
  slashCommands: true,
};
const renderer = { rendererId: "conversation", resource: { type: "session", id: "s" } };
const values = { harness: { harnessId: "agent", model: "B", params: { thinking: "low" } } };
const context = () =>
  makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { sessions: { getHarnessCommands: async () => state } },
  });

test("selecting a native composer command tags the existing draft without replacing text or files", async () => {
  const result = await act(context(), {
    renderer,
    draftKey: "s",
    action: { type: "selectCommand", name: "/goal", values },
  });
  expect(result.draft).toBeUndefined();
  expect(commandIntent({ ...values, ...result.snapshot?.values })).toMatchObject({
    harnessId: "agent",
    command: { name: "/goal" },
  });
  expect(result.snapshot?.draftTag?.label).toBe("Goal");
});

test("Skip and Cancel dismiss without invoking native execution; approval checks the displayed mode revision", async () => {
  const ctx = context();
  let invokes = 0;
  ctx.sessions.invokeHarnessOperation = async () => {
    invokes++;
    return { status: "completed" };
  };
  const decisionId = harnessConfirmationId("s", mode);
  for (const actionId of ["skip", "continue"]) {
    const result = await act(ctx, {
      renderer,
      draftKey: "s",
      action: { type: "decision", id: decisionId, actionId, modeSnapshot: mode, values },
    });
    expect(result.snapshot?.decision).toBeNull();
  }
  expect(invokes).toBe(0);
  ctx.sessions.getHarnessCommands = async () => ({
    ...state,
    modes: [{ ...mode, description: "Changed plan", confirmation: { ...mode.confirmation, id: "revision-2" } }],
  });
  await expect(
    act(ctx, {
      renderer,
      draftKey: "s",
      action: { type: "decision", id: decisionId, actionId: "approve", modeSnapshot: mode, values },
    }),
  ).rejects.toThrow("changed");
  expect(invokes).toBe(0);
});

test("account commands never pass through ordinary native operations", async () => {
  await expect(
    act(context(), {
      renderer,
      draftKey: "s",
      action: { type: "submit", text: "/login secret", attachments: [], values },
    }),
  ).rejects.toThrow("account");
});

test("tagged native input invokes the public operation once, keeps saved request settings and stores recovery outside records", async () => {
  const { nativeSubmissionIndex, readNativeSubmissions } = await import("./native-submission");
  const { withCommandIntent } = await import("./command-intent");
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      sessions: {
        getHarnessCommands: async () => state,
        get: async () => ({ id: "s", lastRequestStarted: "before" }) as never,
      },
    },
  });
  const invokes: unknown[] = [];
  let followups = 0;
  ctx.sessions.invokeHarnessOperation = async (...input) => {
    invokes.push(input);
    return { status: "started", message: "Accepted native work" };
  };
  ctx.sessions.followup = async () => {
    followups++;
  };
  ctx.sessions.getExecutionState = async () => ({ kind: "local", available: true });
  ctx.sessions.getConversation = async () => ({
    session: { id: "s", agent: "agent", status: "completed", params: {} } as never,
    messages: [],
  });
  ctx.sessions.getForkState = async () => ({ supported: false, disabledReason: null });
  ctx.sessions.getQueuedMessages = async () => ({
    messages: [],
    queue: { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null },
  });
  const tagged = withCommandIntent(values, { harnessId: "agent", command: state.commands[0]! });
  const result = await act(ctx, {
    renderer,
    draftKey: "s",
    action: { type: "submit", text: "Keep the full objective", attachments: [], values: tagged },
  });
  expect(invokes).toEqual([["s", { kind: "command", text: "/goal Keep the full objective" }, "agent"]]);
  expect(followups).toBe(0);
  expect(result.snapshot?.draftTag).toBeNull();
  expect(result.snapshot?.sentTag?.label).toBe("Goal");
  expect(commandIntent({ ...tagged, ...result.snapshot?.values })).toBeUndefined();
  const saved = await readNativeSubmissions(ctx, "s", true);
  expect(saved[0]?.body.draft).toMatchObject({ text: "Keep the full objective", values: tagged });
  expect(saved[0]?.value.previousRequest).toBe("before");
});

test("hiding a submitted reference preserves pending recovery and refuses another session's record", async () => {
  const { nativeSubmissionIndex, readNativeSubmissions, saveNativeSubmission } = await import("./native-submission");
  const ctx = makeCommandContext({ storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }), params: {} });
  const draft = { text: "Objective", attachments: [], values };
  const recordId = await saveNativeSubmission(
    ctx,
    "s",
    { draft, operation: { kind: "command", text: "/goal Objective" } },
    "before",
    true,
  );
  const result = await nativeAction(ctx, "s", { type: "operation", id: `hide-native:${recordId}`, values });
  expect(result?.snapshot).toMatchObject({ sentTag: null });
  expect((await readNativeSubmissions(ctx, "s", true))[0]?.body.draft.text).toBe("Objective");
  await expect(
    nativeAction(ctx, "other", { type: "operation", id: `hide-native:${recordId}`, values }),
  ).rejects.toThrow("this conversation");
});

test("a completed idle native operation keeps its result through refresh until the next request", async () => {
  const { nativeSubmissionIndex } = await import("./native-submission");
  const { nativePresentation } = await import("./native-presentation");
  let requestStarted = "before";
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      sessions: {
        getHarnessCommands: async () => state,
        get: async () => ({ id: "s", lastRequestStarted: requestStarted }) as never,
        invokeHarnessOperation: async () => {
          // Idle control operations enter the existing resume lifecycle too.
          requestStarted = "native-control";
          return { status: "completed", message: "Native action completed" };
        },
      },
    },
  });
  await act(ctx, {
    renderer,
    draftKey: "s",
    action: { type: "submit", text: "/goal Objective", attachments: [], values },
  });
  const present = () =>
    nativePresentation(ctx, "s", state, "agent", values, { status: "completed", lastRequestStarted: requestStarted });
  expect((await present()).notice).toBe("Native action completed");
  expect((await present()).notice).toBe("Native action completed");
  requestStarted = "later-ordinary";
  expect((await present()).notice).toBe("");
});
