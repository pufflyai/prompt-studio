import { putTicket } from "../data/ticket-context.fixture";
import { fixture } from "./auto-build.fixture";

export const waitingPage = async () => {
  const began = performance.now();
  const f = await fixture();
  console.log("PS-1281 diagnostic base fixture ms", performance.now() - began);
  await putTicket(f.storage, {
    id: "prerequisite",
    shorthand: "T-102",
    title: "Resolve the prerequisite",
    content: "# Prerequisite",
    position: "00001",
    statusId: "backlog",
    archived: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  await f.storage.collection("planner-review-requests").put("request", {
    id: "request",
    ticketId: "prerequisite",
    title: "Choose the implementation",
    instructions: "Resolve the choice before starting",
    request: { kind: "task" },
    requestedAt: "2026-01-01",
    requestedBy: { type: "human", id: "user", displayName: "User" },
    context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: null, relatedSessionId: null },
  });
  for (let i = 0; i <= 100; i++) {
    const id = `ticket-${String(i).padStart(3, "0")}`;
    await putTicket(f.storage, {
      id,
      shorthand: `T-${i + 1}`,
      title: i === 100 ? "Launchable later work" : `Waiting ${i}`,
      content: "# Work",
      position: `${(i + 1).toString(16).padStart(4, "0")}1`,
      statusId: "ready",
      dependsOn: i < 100 ? ["prerequisite"] : [],
      archived: false,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  }
  f.ctx.sessions.query = async () => ({ items: [], nextCursor: null });
  console.log("PS-1281 diagnostic 101 ready tickets seeded ms", performance.now() - began);
  const collection = f.storage.collection.bind(f.storage);
  f.storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw new Error(`Unbounded ${name}`);
    },
  });
  return f;
};
