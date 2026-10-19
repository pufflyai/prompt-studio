import { expect, test } from "bun:test";
import { defaultAutoBuildIgnore } from "../data/auto-build-mode";
import { putTicket, ticketsCollection } from "../data/collections";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { autoBuildScopeCommand } from "./auto-build-scope";
import { runAttemptCommand } from "./run-attempt";

const scope = async (ctx: Awaited<ReturnType<typeof fixture>>["ctx"]) => {
  const { revision } = await readAutoBuildCommand.run(ctx, {});
  await autoBuildScopeCommand.run(ctx, { revision, queries: [{}] });
};

test("a new project starts stopped with empty ticket filters", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: false,
    prompt: "",
    eligible: { conjunction: "and", rules: [] },
    ignore: await defaultAutoBuildIgnore(ctx),
  });
});

test("saves the prompt and ignore filter across stopping and restarting", async () => {
  const { ctx, ticket } = await fixture();
  await ticket("Configure statuses");
  const ignore = {
    conjunction: "and" as const,
    rules: [{ attributeId: "title", condition: "contains" as const, value: "Postpone" }],
  };
  const first = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    prompt: "Focus on the release.",
    ignore,
    eligible: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready"] }] },
  });
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  const restarted = await configureAutoBuildCommand.run(ctx, { enabled: true });
  expect(restarted.revision).not.toBe(first.revision);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: true,
    prompt: "Focus on the release.",
    ignore,
  });
});

test("starting requires a nonempty supervisor prompt", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  await expect(configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "  " })).rejects.toThrow("Enter a prompt");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});

test("starting rejects incomplete eligible filters and leaves the run stopped", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  await expect(
    configureAutoBuildCommand.run(ctx, {
      enabled: true,
      prompt: "Build it",
      eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "" }] },
    }),
  ).rejects.toThrow("eligible");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});

test("Auto Build succeeds when its scoped tickets are completed", async () => {
  const { ctx, ticket, storage } = await fixture();
  const first = await ticket("Calculator addition");
  const second = await ticket("Calculator subtraction");
  await scope(ctx);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
  await putTicket(storage, { ...first, statusId: "done" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
  await putTicket(storage, { ...second, statusId: "done" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: true, stuck: false });
  await putTicket(storage, { ...second, statusId: "ready" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
});

test("started work that leaves the eligible status keeps Auto Build unfinished", async () => {
  const { ctx, ticket, storage } = await fixture();
  const started = await ticket("Calculator addition");
  const finished = await ticket("Calculator subtraction");
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready"] }] },
  });
  await scope(ctx);
  await runAttemptCommand.run(ctx, { ticket: started.id });
  await putTicket(storage, {
    ...(await storage.collection("tickets").get(started.id))!,
    statusId: "in-progress",
  } as never);
  await putTicket(storage, { ...finished, statusId: "done" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
});

test("Auto Build does not report success before its scope is saved or after stopping", async () => {
  const { ctx, ticket, storage } = await fixture();
  const selected = await ticket("Calculator addition");
  await putTicket(storage, { ...selected, statusId: "done" });
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
  await configureAutoBuildCommand.run(ctx, { enabled: true });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
  await scope(ctx);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: true });
});

test("completed ticket work clears an old supervisor automation error", async () => {
  const { ctx, ticket, storage } = await fixture();
  const selected = await ticket("Calculator addition");
  ctx.automation.list = async () =>
    [
      {
        commandId: `${ctx.extensionId}.command.auto-build`,
        createdAt: "2026-10-13T00:00:00Z",
        status: "failed",
        error: { message: "Supervisor failed earlier" },
      },
    ] as never;
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    completed: false,
    error: "Supervisor failed earlier",
  });
  await scope(ctx);
  await putTicket(storage, { ...selected, statusId: "done" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: true, error: undefined });
});
