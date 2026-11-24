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
    expect(projectQueuedFollowUps(queue, peer.getSnapshot()[0])).toEqual([queue[1], queue[0]]);
    expect(other.getSnapshot()).toEqual([]);
    const newer = [queue[0]!, { ...queue[1]!, revision: "newer" }];
    expect(projectQueuedFollowUps(newer, peer.getSnapshot()[0])).toBe(newer);
    await expect(peer.run(move, undefined, execute)).rejects.toThrow("still pending");
    expect(await peer.run({ type: "stop" }, 1, async () => "Stop acknowledged")).toBe("Stop acknowledged");
    transport.reject(new PstdioConnectionError(new Error("Queue response lost")));
    await expect(attempted).rejects.toThrow();
    expect(peer.getSnapshot()[0]?.status).toBe("unknown");
    expect(projectQueuedFollowUps(queue, peer.getSnapshot()[0])).toBe(queue);
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
