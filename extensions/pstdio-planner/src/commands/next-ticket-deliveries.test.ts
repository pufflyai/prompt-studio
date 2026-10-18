import { expect, test } from "bun:test";
import { listAttempts } from "../data/attempt-storage";
import { putTicket } from "../data/collections";
import { fixture } from "./auto-build.fixture";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { nextTicketsCommand } from "./next-tickets";

async function sharedDelivery() {
  const f = await fixture();
  const parent = await f.ticket("Delivered prerequisite");
  await putTicket(f.storage, {
    ...parent,
    statusId: "done",
    reviewLinks: [
      {
        id: "delivery",
        provider: "github",
        kind: "pull_request",
        externalId: "1",
        title: null,
        url: "https://github.com/acme/tools/pull/1",
        createdAt: parent.createdAt,
        updatedAt: parent.updatedAt,
      },
    ],
  });
  const children = [await f.ticket("First child", [parent.id]), await f.ticket("Second child", [parent.id])];
  let reads = 0;
  let merged = true;
  const run = f.ctx.process.run;
  f.ctx.process.run = async (input) => {
    if (input.command[0] !== "gh") return run(input);
    reads++;
    return {
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({
        state: merged ? "MERGED" : "OPEN",
        headRefOid: "head",
        mergeCommit: { oid: "main-sha" },
      }),
    };
  };
  return {
    ...f,
    children,
    reads: () => reads,
    reopen: () => {
      merged = false;
    },
  };
}

test("next tickets reads a shared delivery once per query and refreshes it on the next query", async () => {
  const f = await sharedDelivery();
  expect((await nextTicketsCommand.run(f.ctx, {})).tickets.map(({ id }) => id)).toEqual(f.children.map(({ id }) => id));
  expect(f.reads()).toBe(1);
  f.reopen();
  const refreshed = await nextTicketsCommand.run(f.ctx, {});
  expect(refreshed.tickets).toEqual([]);
  expect(refreshed.waiting).toEqual(
    f.children.map(({ id }) => expect.objectContaining({ id, reason: "dependency-not-ready" })),
  );
  expect(f.reads()).toBe(2);
});

test("dispatch refreshes delivery evidence for its final readiness check", async () => {
  const f = await sharedDelivery();
  const run = f.ctx.process.run;
  let reads = 0;
  f.ctx.process.run = async (input) => {
    if (input.command[0] === "gh" && ++reads === 3) f.reopen();
    return run(input);
  };
  await expect(autoBuildDispatchCommand.run(f.ctx, { ticket: f.children[0]!.id, revision: "test" })).rejects.toThrow(
    "no longer ready",
  );
  expect(await listAttempts(f.storage)).toEqual([]);
  expect(f.reads()).toBe(3);
});
