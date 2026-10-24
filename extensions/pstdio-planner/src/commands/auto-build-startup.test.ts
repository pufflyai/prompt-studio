import { expect, test } from "bun:test";
import { putTicket } from "../data/ticket-context.fixture";

import { autoBuildCommand } from "./auto-build";
import { readAutoBuildCommand } from "./auto-build-mode";
import { supervisorFixture } from "./auto-build-supervisor.fixture";

async function startupReads(ticketCount: number) {
  const { ctx, ticket, prompts } = await supervisorFixture();
  for (let index = 0; index < ticketCount; index++) await ticket(`Ready work ${index}`);
  const run = ctx.process.run;
  let reads = 0;
  ctx.process.run = async (input) => {
    reads++;
    return run(input);
  };
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
  expect(prompts).toHaveLength(1);
  return reads;
}

test("starting the supervisor does not inspect every ready ticket's Git state", async () => {
  const oneTicket = await startupReads(1);
  expect(await startupReads(25)).toBe(oneTicket);
});

test("queued startup status does not wait for a Git readiness scan", async () => {
  const { ctx, ticket } = await supervisorFixture();
  await ticket("Ready work");
  ctx.automation.list = async () =>
    [
      {
        commandId: `${ctx.extensionId}.command.auto-build`,
        status: "queued",
        createdAt: new Date().toISOString(),
      },
    ] as never;
  ctx.process.run = async () => {
    throw new Error("Startup status waited for Git");
  };
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: true, running: true, stuck: false });
});

test("startup keeps looking when earlier tickets are blocked", async () => {
  const { ctx, storage, ticket, prompts } = await supervisorFixture();
  const blocked = await ticket("Blocked first");
  await putTicket(storage, { ...blocked, blockedReason: "Waiting for access" });
  await ticket("Eligible next");
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
  expect(prompts).toHaveLength(1);
});
