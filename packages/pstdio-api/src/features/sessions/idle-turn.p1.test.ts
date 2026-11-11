import { expect, test } from "bun:test";
import type { HarnessEventSink, HarnessSteeringInput, HarnessTurnChannel } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../harnesses/test-harness-registry";

const backgroundTasks = [{ id: "watch", description: "Watch the extension for changes" }];
const headers = { "content-type": "application/json" };

// A run that stays open between turns, like Claude Code with a background command still running.
const setup = async () => {
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
    body: JSON.stringify({ projectId: project.id, title: "Background work", prompt: "Start the watcher" }),
  });
  expect(created.status).toBe(201);
  const session = await created.json();
  const { turns } = await started.promise;
  const owner = handle.deps.sessionService.store.get(session.id)!;

  const followUp = async (prompt: string, extra: Record<string, unknown> = {}) => {
    const response = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, ...extra }),
    });
    expect(response.status).toBe(200);
    await owner.idleDelivery;
  };
  const queued = async () =>
    (await handle.deps.sessionQueueEntriesService.listUndispatchedBySession(session.id)).map((entry) => entry.prompt);
  const idle = async () => {
    turns.idle({ backgroundTasks });
    await owner.idleDelivery;
  };
  return { handle, owner, turns, received, followUp, queued, idle };
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

test("an open question holds queued replies", async () => {
  const { handle, owner, received, followUp, idle } = await setup();
  try {
    const ask = owner.questionService
      .ask({ id: "question", toolUseId: "question", questions: [{ question: "Confirm?" }] })
      .catch(() => undefined);
    await followUp("Unrelated reply");
    await idle();
    expect(received).toHaveLength(0);
    owner.questionService.dispose();
    await ask;
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
