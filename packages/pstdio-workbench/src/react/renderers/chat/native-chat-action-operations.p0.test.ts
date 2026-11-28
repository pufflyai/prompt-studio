import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { type ChatRendererAction, createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "../../../core/registries/mutations/operations";
import { createChatActionOperations } from "../../../extensions/contributions/chat-action-operations";
import { projectQueuedFollowUps } from "./native-chat-queue";

const queue = [
  { id: "position-1", position: 1, revision: "r1", prompt: "First" },
  { id: "position-2", position: 2, revision: "r2", prompt: "Second" },
];
const session = { type: "session", extensionId: "pstdio", projectId: "project", id: "session" };

test("queue reordering shares its immediate display and restores the acknowledged rows after a lost response", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const first = createChatActionOperations(queries, session, "project");
  const peer = createChatActionOperations(queries, session, "project");
  const other = createChatActionOperations(queries, { ...session, id: "other" }, "project");
  const transport = Promise.withResolvers<never>();
  const move: ChatRendererAction = {
    type: "queue",
    operation: "move",
    direction: "up",
    item: queue[1]!,
    attachments: [],
    values: {},
  };
  let writes = 0;
  const execute = () => {
    writes++;
    return transport.promise;
  };
  try {
    const attempted = first.run(move, undefined, execute);
    expect(projectQueuedFollowUps(queue, peer.getSnapshot())).toEqual([queue[1], queue[0]]);
    expect(other.getSnapshot()).toEqual([]);
    const newer = [queue[0]!, { ...queue[1]!, revision: "newer" }];
    expect(projectQueuedFollowUps(newer, peer.getSnapshot())).toBe(newer);
    expect(await peer.run({ type: "stop" }, 1, async () => "Stop acknowledged")).toBe("Stop acknowledged");
    transport.reject(new PstdioConnectionError(new Error("Queue response lost")));
    await expect(attempted).rejects.toThrow();
    expect(peer.getSnapshot()[0]?.status).toBe("unknown");
    expect(projectQueuedFollowUps(queue, peer.getSnapshot())).toBe(queue);
    expect(writes).toBe(1);
    const operations = getWorkbenchOperations(queries);
    expect(operations.getSnapshot().recovery[0]).toMatchObject({ canCheck: false, draft: { prompt: "Second" } });
    operations.discard(operations.getSnapshot().recovery[0]!.id);
    expect(peer.getSnapshot()).toEqual([]);
  } finally {
    queries.dispose();
  }
});

test("a different approval or active run can proceed while an earlier action is unresolved", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const actions = createChatActionOperations(queries, session, "project");
  const lost = async () => {
    throw new PstdioConnectionError(new Error("Response lost"));
  };
  const accepted = async () => "accepted";
  try {
    const approval = { type: "approve" as const, id: "original", choice: "approve" };
    await expect(actions.run(approval, 1, lost)).rejects.toThrow();
    await expect(actions.run(approval, 1, accepted)).rejects.toThrow("still pending");
    expect(await actions.run({ ...approval, id: "next" }, 1, accepted)).toBe("accepted");
    await expect(actions.run({ type: "stop" }, 1, lost)).rejects.toThrow();
    await expect(actions.run({ type: "stop" }, 1, accepted)).rejects.toThrow("still pending");
    expect(await actions.run({ type: "stop" }, 2, accepted)).toBe("accepted");
  } finally {
    queries.dispose();
  }
});

test("quick queue changes show at once and run one after another without locking the queue", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const actions = createChatActionOperations(queries, session, "project");
  const remove = (item: (typeof queue)[number]): ChatRendererAction => ({
    type: "queue",
    operation: "remove",
    item,
    attachments: [],
    values: {},
  });
  const first = Promise.withResolvers<void>();
  const order: string[] = [];
  try {
    const removingFirst = actions.run(remove(queue[0]!), undefined, async () => {
      order.push("first");
      await first.promise;
    });
    const removingSecond = actions.run(remove(queue[1]!), undefined, async () => {
      order.push("second");
    });
    expect(projectQueuedFollowUps(queue, actions.getSnapshot())).toEqual([]);
    await new Promise((done) => setTimeout(done, 0));
    expect(order).toEqual(["first"]);
    first.resolve();
    await Promise.all([removingFirst, removingSecond]);
    expect(order).toEqual(["first", "second"]);
    expect(actions.getSnapshot()).toEqual([]);
  } finally {
    queries.dispose();
  }
});

test("a second change to a moved message is sent against the queue the move returned", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const actions = createChatActionOperations(queries, session, "project");
  let confirmed = [...queue];
  const move: ChatRendererAction = {
    type: "queue",
    operation: "move",
    direction: "up",
    item: queue[1]!,
    attachments: [],
    values: {},
  };
  const remove: ChatRendererAction = {
    type: "queue",
    operation: "remove",
    item: queue[1]!,
    attachments: [],
    values: {},
  };
  const sent: ChatRendererAction[] = [];
  try {
    const moving = actions.run(
      move,
      undefined,
      async (action) => {
        sent.push(action);
        // The runtime renumbers both rows and issues new revisions.
        confirmed = [
          { ...queue[1]!, position: 1, revision: "r3" },
          { ...queue[0]!, position: 2, revision: "r4" },
        ];
      },
      () => confirmed,
    );
    const removing = actions.run(
      remove,
      undefined,
      async (action) => void sent.push(action),
      () => confirmed,
    );
    await Promise.all([moving, removing]);
    expect(sent[1]).toMatchObject({ operation: "remove", item: { prompt: "Second", position: 1, revision: "r3" } });
  } finally {
    queries.dispose();
  }
});

test("changes waiting behind a lost queue response are refused instead of hanging", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const actions = createChatActionOperations(queries, session, "project");
  const remove = (item: (typeof queue)[number]): ChatRendererAction => ({
    type: "queue",
    operation: "remove",
    item,
    attachments: [],
    values: {},
  });
  let writes = 0;
  try {
    const lost = actions.run(remove(queue[0]!), undefined, async () => {
      writes++;
      throw new PstdioConnectionError(new Error("Queue response lost"));
    });
    const waiting = actions.run(remove(queue[1]!), undefined, async () => {
      writes++;
    });
    const [lostResult, waitingResult] = await Promise.allSettled([lost, waiting]);
    expect(lostResult.status).toBe("rejected");
    expect(waitingResult).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({
        message: expect.stringContaining("An earlier queue change did not go through"),
      }),
    });
    expect(writes).toBe(1);
    expect(projectQueuedFollowUps(queue, actions.getSnapshot())).toEqual(queue);
  } finally {
    queries.dispose();
  }
});

test("creating a queue item from a message that has left the queue is sent as is", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const actions = createChatActionOperations(queries, session, "project");
  const gone = { id: "position-9", position: 9, revision: "r9", prompt: "Steered away" };
  const create: ChatRendererAction = {
    type: "queue",
    operation: "create",
    item: gone,
    prompt: "Retained edit",
    attachments: [],
    values: {},
  };
  const sent: ChatRendererAction[] = [];
  const held = Promise.withResolvers<void>();
  try {
    const first = actions.run(
      { type: "queue", operation: "remove", item: queue[0]!, attachments: [], values: {} },
      undefined,
      () => held.promise,
      () => queue,
    );
    const creating = actions.run(
      create,
      undefined,
      async (action) => void sent.push(action),
      () => queue,
    );
    held.resolve();
    await Promise.all([first, creating]);
    expect(sent).toEqual([create]);
  } finally {
    queries.dispose();
  }
});
