import { expect, test } from "bun:test";
import { putTicket } from "../data/collections";
import { fixture } from "./auto-build.fixture";
import { autoBuildCandidatesCommand } from "./auto-build-candidates";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { configureAutoBuildCommand } from "./auto-build-mode";

test("eligible ticket filters narrow scope discovery and dispatch while ignore filters take precedence", async () => {
  const { ctx, ticket } = await fixture();
  const addition = await ticket("Calculator addition");
  const subtraction = await ticket("Calculator subtraction");
  const greeting = await ticket("Welcome message");
  const eligible = {
    conjunction: "and" as const,
    rules: [{ attributeId: "title", condition: "contains" as const, value: "Calculator" }],
    groups: [
      {
        conjunction: "or" as const,
        rules: [{ attributeId: "status", condition: "is-any-of" as const, value: ["ready"] }],
      },
    ],
  };
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible,
    ignore: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "subtraction" }] },
    scopeTicketIds: null,
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).scopeOptions.map(({ id }) => id)).toEqual([addition.id]);
  const mode = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    scopeTicketIds: [addition.id, subtraction.id, greeting.id],
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.map(({ id }) => id)).toEqual([addition.id]);
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
    ignore: { conjunction: "and", rules: [] },
    scopeTicketIds: null,
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).scopeOptions.map(({ id }) => id)).toEqual([backlog.id]);
});

test("changing ticket filters asks the supervisor to resolve the feature scope again", async () => {
  const { ctx, ticket } = await fixture();
  const addition = await ticket("Calculator addition");
  const subtraction = await ticket("Calculator subtraction");
  await configureAutoBuildCommand.run(ctx, { enabled: true, scopeTicketIds: [addition.id] });
  const changed = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Calculator" }] },
  });
  expect(changed.scopeTicketIds).toBeNull();
  expect((await autoBuildCandidatesCommand.run(ctx, {})).scopeOptions.map(({ id }) => id)).toEqual([
    addition.id,
    subtraction.id,
  ]);
});
