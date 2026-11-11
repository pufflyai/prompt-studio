import { expect, test } from "bun:test";
import type { HarnessEventSink, HarnessSteeringInput, HarnessTurnChannel } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../harnesses/test-harness-registry";

const backgroundTasks = [{ id: "watch", description: "Watch the extension for changes" }];
const headers = { "content-type": "application/json" };

// A run that stays open between turns, like Claude Code with a background command still running.
const setup = async (options: { duringSteer?: (turns: HarnessTurnChannel) => void } = {}) => {
  const received: HarnessSteeringInput[] = [];
  const started = Promise.withResolvers<{ turns: HarnessTurnChannel; events: HarnessEventSink }>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("local", {
      provider: {
        start: (_ctx, input) => {
          started.resolve({ turns: input.turns!, events: input.events });
          return {
            done: new Promise(() => {}),
            stop: () => {},
            timeoutStrategy: "provider" as const,
            steer: async (steering) => {
              received.push(steering);
              input.events.push({
                op: "add",
                path: `/messages/${input.events.getMessages().length}`,
                value: { id: steering.deliveryId, role: "user", parts: [{ type: "text", text: steering.prompt }] },
              });
              options.duringSteer?.(input.turns!);
              return { status: "accepted" as const };
            },
          };
        },
      },
    }),
  ]);
  const handle = await createTestApp({ harnessRegistry: registry });
  const project = await (
    await handle.app.request("/v1/projects", {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "Idle turns" })),
    })
  ).json();
  const created = await handle.app.request("/v1/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      projectId: project.id,
      title: "Background work",
      prompt: "Start the watcher",
      model: "run-model",
    }),
  });
  expect(created.status).toBe(201);
  const session = await created.json();
  const { turns } = await started.promise;
  const owner = handle.deps.sessionService.store.get(session.id)!;

  const followUp = async (prompt: string, extra: Record<string, unknown> = {}) => {
    const response = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers,
      // Later replies would otherwise inherit the last selected model.
      body: JSON.stringify({ prompt, model: "run-model", ...extra }),
    });
    expect(response.status).toBe(200);
    await owner.idleDelivery;
  };
  const queue = () => handle.deps.sessionQueueEntriesService.listUndispatchedBySession(session.id);
  const queued = async () => (await queue()).map((entry) => entry.prompt);
  const remove = async (position: number) => {
    const response = await handle.app.request(`/v1/sessions/${session.id}/queued-follow-ups/${position}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    await owner.idleDelivery;
  };
  const idle = async () => {
    turns.idle({ backgroundTasks });
    await owner.idleDelivery;
  };
  return { handle, owner, turns, received, followUp, queue, queued, remove, idle };
};

test("a reply waits in the queue while the turn runs and goes in when the turn ends", async () => {
  const { handle, owner, received, followUp, queued, idle } = await setup();
  try {
    await followUp("Yes, make the fix");
    expect(received).toHaveLength(0);
    expect(await queued()).toEqual(["Yes, make the fix"]);

    await idle();

    expect(received.map((input) => input.prompt)).toEqual(["Yes, make the fix"]);
    expect(await queued()).toEqual([]);
    expect(owner.idleTurn).toBeNull();
  } finally {
    await handle.close();
  }
});

test("a reply sent during an idle turn goes in right away, one request per turn", async () => {
  const { handle, owner, turns, received, followUp, queued, idle } = await setup();
  try {
    turns.idle({ backgroundTasks });
    expect(owner.idleTurn).toEqual({ backgroundTasks });

    await followUp("Open a PR");
    expect(received.map((input) => input.prompt)).toEqual(["Open a PR"]);

    // The delivered request started a turn, so the next one waits for that turn to end.
    await followUp("Then link the ticket");
    expect(received).toHaveLength(1);
    expect(await queued()).toEqual(["Then link the ticket"]);

    await idle();
    expect(received.map((input) => input.prompt)).toEqual(["Open a PR", "Then link the ticket"]);
  } finally {
    await handle.close();
  }
});

test("an idle turn keeps queue order when the oldest request needs a new run", async () => {
  const { handle, received, followUp, queued, idle } = await setup();
  try {
    await followUp("Think harder about it", { model: "other-model" });
    await followUp("Then continue");

    await idle();

    expect(received).toHaveLength(0);
    expect(await queued()).toEqual(["Think harder about it", "Then continue"]);
  } finally {
    await handle.close();
  }
});

test("removing the request that holds the queue lets the next one into the idle turn", async () => {
  const { handle, received, followUp, queue, queued, remove, idle } = await setup();
  try {
    await followUp("Use another model", { model: "other-model" });
    await followUp("Then continue");
    await idle();
    expect(received).toHaveLength(0);

    await remove((await queue())[0]!.queue_position);

    expect(received.map((input) => input.prompt)).toEqual(["Then continue"]);
    expect(await queued()).toEqual([]);
  } finally {
    await handle.close();
  }
});

test("an open question holds queued replies until the turn after it ends", async () => {
  const { handle, owner, received, followUp, queued, idle } = await setup();
  try {
    await followUp("Unrelated reply");
    const ask = owner.questionService
      .ask({ id: "question", toolUseId: "question", questions: [{ question: "Confirm?" }] })
      .catch(() => undefined);
    await idle();
    expect(received).toHaveLength(0);
    expect(await queued()).toEqual(["Unrelated reply"]);

    owner.questionService.answer("Yes");
    await ask;
    await idle();
    expect(received.map((input) => input.prompt)).toEqual(["Unrelated reply"]);
  } finally {
    await handle.close();
  }
});

test("a turn that ends again before delivery finishes stays idle for the next request", async () => {
  // The provider starts and finishes the delivered turn before the host confirms delivery.
  const { handle, owner, received, followUp, queued, idle } = await setup({
    duringSteer: (turns) => {
      turns.busy();
      turns.idle({ backgroundTasks });
    },
  });
  try {
    await followUp("First");
    await followUp("Second");
    await idle();
    await owner.idleDelivery;

    expect(received.map((input) => input.prompt)).toEqual(["First", "Second"]);
    expect(await queued()).toEqual([]);
    expect(owner.idleTurn).toEqual({ backgroundTasks });
  } finally {
    await handle.close();
  }
});

test("the conversation stream reports when a turn becomes idle and when the next one starts", async () => {
  const { handle, owner, turns } = await setup();
  try {
    const start = owner.eventStore.getHistory().length;
    turns.idle({ backgroundTasks });
    turns.busy();
    expect(owner.eventStore.getHistory().slice(start)).toEqual([
      { op: "replace", path: "/idle_turn", value: { backgroundTasks } },
      { op: "replace", path: "/idle_turn", value: null },
    ]);
  } finally {
    await handle.close();
  }
});

test("a run that ends during an idle turn clears the idle state for open streams", async () => {
  const exit = Promise.withResolvers<{ status: "completed" }>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("local", {
      provider: {
        start: (_ctx, input) => {
          queueMicrotask(() => input.turns!.idle({ backgroundTasks }));
          return { done: exit.promise, stop: () => {}, timeoutStrategy: "provider" as const };
        },
      },
    }),
  ]);
  const handle = await createTestApp({ harnessRegistry: registry });
  try {
    const project = await (
      await handle.app.request("/v1/projects", {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Idle run end" })),
      })
    ).json();
    const session = await (
      await handle.app.request("/v1/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({ projectId: project.id, title: "Ends idle", prompt: "Start" }),
      })
    ).json();
    const owner = handle.deps.sessionService.store.get(session.id)!;
    while (!owner.idleTurn) await Bun.sleep(5);
    const start = owner.eventStore.getHistory().length;

    exit.resolve({ status: "completed" });
    while ((await handle.deps.sessionService.get(session.id))?.status !== "completed") await Bun.sleep(5);

    expect(owner.idleTurn).toBeNull();
    expect(owner.eventStore.getHistory().slice(start)).toContainEqual({
      op: "replace",
      path: "/idle_turn",
      value: null,
    });
  } finally {
    await handle.close();
  }
});
