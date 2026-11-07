import { expect, test } from "bun:test";
import { createChatSession } from "./chat-session";

const plan = (id: string) => ({
  id,
  actions: [
    { id: "skip", label: "Skip", variant: "ghost" as const },
    { id: "approve", label: "Approve", variant: "primary" as const },
  ],
});
test("native decision revisions stay dismissed across real refreshes, other modes remain usable, and reopen clears only its revision", async () => {
  let offered = [plan("plan-1"), plan("goal-1")];
  const create = () =>
    createChatSession({
      query: async () => ({ decisions: offered }),
      action: async (action) =>
        action.type === "confirmation"
          ? { snapshot: { decision: offered.find((item) => item.id === action.modeId) } }
          : { snapshot: { decision: null } },
    });
  const session = create();
  const close = session.retain();
  await Bun.sleep(0);
  expect(session.getSnapshot().conversation.decision?.id).toBe("plan-1");
  await session.run({ type: "decision", id: "plan-1", actionId: "skip", values: {} });
  session.accept({ revision: 0, snapshot: { decisions: offered } });
  expect(session.getSnapshot().conversation.decision?.id).toBe("goal-1");
  await session.run({ type: "decision", id: "goal-1", actionId: "continue", values: {} });
  session.accept({ revision: 1, snapshot: { decisions: offered } });
  expect(session.getSnapshot().conversation.decision).toBeNull();
  await session.run({ type: "confirmation", modeId: "goal-1", values: {} });
  expect(session.getSnapshot().conversation.decision?.id).toBe("goal-1");
  await session.run({ type: "decision", id: "goal-1", actionId: "approve", values: {} });
  session.reconnect();
  await Bun.sleep(0);
  expect(session.getSnapshot().conversation.decision).toBeNull();
  offered = [plan("plan-2"), plan("goal-1")];
  session.accept({ revision: 0, snapshot: { decisions: offered } });
  expect(session.getSnapshot().conversation.decision?.id).toBe("plan-2");
  close();
  const reloaded = create();
  const closeReload = reloaded.retain();
  await Bun.sleep(0);
  expect(reloaded.getSnapshot().conversation.decision?.id).toBe("plan-2");
  expect(reloaded.getSnapshot().draft.values).toEqual({});
  closeReload();
});

test("initial native decisions are immediately available, and a stale dismissal cannot hide a revised decision", async () => {
  const action = Promise.withResolvers<unknown>();
  const session = createChatSession({
    initial: { decisions: [plan("first"), plan("other")] },
    query: async () => ({}),
    action: () => action.promise,
  });
  expect(session.getSnapshot().conversation.decision?.id).toBe("first");
  const dismissing = session.run({ type: "decision", id: "first", actionId: "skip", values: {} });
  session.accept({ revision: 0, snapshot: { decisions: [plan("revised"), plan("other")] } });
  action.resolve({ snapshot: { decision: null } });
  await dismissing;
  expect(session.getSnapshot().conversation.decision?.id).toBe("revised");
});

test("a delayed dismissal cannot undo a newer explicit reopen of the same decision revision", async () => {
  const skipped = Promise.withResolvers<unknown>();
  const decision = plan("same-revision");
  const session = createChatSession({
    initial: { decisions: [decision] },
    query: async () => ({}),
    action: (action) => (action.type === "decision" ? skipped.promise : Promise.resolve({ snapshot: { decision } })),
  });
  const dismissing = session.run({ type: "decision", id: decision.id, actionId: "skip", values: {} });
  await session.run({ type: "confirmation", modeId: "plan", values: {} });
  skipped.resolve({ snapshot: { decision: null } });
  await dismissing;
  expect(session.getSnapshot().conversation.decision?.id).toBe(decision.id);
});

test("a singular provider's newer reopen survives an older dismissal without a decision catalog", async () => {
  const skipped = Promise.withResolvers<unknown>();
  const decision = plan("single");
  const session = createChatSession({
    initial: { decision },
    query: async () => ({}),
    action: (action) => (action.type === "decision" ? skipped.promise : Promise.resolve({ snapshot: { decision } })),
  });
  const dismissing = session.run({ type: "decision", id: decision.id, actionId: "skip", values: {} });
  await session.run({ type: "confirmation", modeId: "plan", values: {} });
  skipped.resolve({ snapshot: { decision: null } });
  await dismissing;
  expect(session.getSnapshot().conversation.decision?.id).toBe(decision.id);
});
