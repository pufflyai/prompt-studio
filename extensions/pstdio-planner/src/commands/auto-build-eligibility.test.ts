import { putTicket } from "../data/ticket-context.fixture";
import { expect, test } from "bun:test";

import { fixture } from "./auto-build.fixture";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { configureAutoBuildCommand } from "./auto-build-mode";
import { nextTicketsCommand } from "./next-tickets";

test("eligible ticket filters narrow work queries and dispatch", async () => {
  const { ctx, ticket } = await fixture();
  const addition = await ticket("Calculator addition");
  await ticket("Calculator subtraction");
  const greeting = await ticket("Welcome message");
  const eligible = {
    conjunction: "and" as const,
    rules: [
      { attributeId: "title", condition: "contains" as const, value: "Calculator" },
      { attributeId: "title", condition: "does-not-contain" as const, value: "subtraction" },
    ],
    groups: [
      {
        conjunction: "or" as const,
        rules: [{ attributeId: "status", condition: "is-any-of" as const, value: ["ready"] }],
      },
    ],
  };
  const mode = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible,
  });
  expect((await nextTicketsCommand.run(ctx, {})).tickets.map(({ id }) => id)).toEqual([addition.id]);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: greeting.id, revision: mode.revision })).toMatchObject({
    decision: "wait",
    reason: "ticket-not-ready",
  });
});

test("empty eligibility allows valid unfinished tickets while completed tickets remain excluded", async () => {
  const { ctx, ticket, storage } = await fixture();
  const backlog = await ticket("Unscheduled work");
  await putTicket(storage, { ...backlog, statusId: "backlog" });
  const completed = await ticket("Delivered work");
  await putTicket(storage, { ...completed, statusId: "done" });
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible: { conjunction: "and", rules: [] },
  });
  expect((await nextTicketsCommand.run(ctx, {})).tickets.map(({ id }) => id)).toEqual([backlog.id]);
});

test("incomplete eligible filters cannot start Auto Build", async () => {
  const { ctx } = await fixture();
  await expect(
    configureAutoBuildCommand.run(ctx, {
      enabled: true,
      eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "" }] },
    }),
  ).rejects.toThrow("eligible");
});
