import { expect, test } from "bun:test";
import { autoBuildCommand } from "./auto-build";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { supervisorFixture } from "./auto-build-supervisor.fixture";

for (const status of ["completed", "in_progress"] as const) {
  test(`restarting creates a fresh supervisor when the old session is ${status}`, async () => {
    const { ctx, ticket, storage, sessions, prompts } = await supervisorFixture();
    await ticket("Ready work");
    await autoBuildCommand.run(ctx, {});
    const previous = prompts[0]!.sessionId;
    sessions.get(previous)!.status = status;
    await storage.set("auto-build-supervisor", {
      sessionId: previous,
      lastWake: "previous-run",
      scope: { revision: "test", queries: [{ status: "Blocked" }] },
    });
    await configureAutoBuildCommand.run(ctx, { enabled: false });
    await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Start the new brief." });
    expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ supervisor: null });
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
    const current = prompts.at(-1)!;
    expect(current.sessionId).not.toBe(previous);
    expect(current.prompt).toContain("Start the new brief.");
    expect(sessions.get(previous)!.status).toBe(status);
    sessions.get(current.sessionId)!.status = "completed";
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ sessionId: current.sessionId });
  });
}

test("a restart cannot be overwritten by a wake that is still creating its supervisor", async () => {
  const { ctx, ticket, prompts } = await supervisorFixture();
  await ticket("Ready work");
  const create = ctx.sessions.create;
  let rejectedStart: unknown;
  ctx.sessions.create = async (input) => {
    await configureAutoBuildCommand.run(ctx, { enabled: false });
    try {
      await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "New run" });
    } catch (error) {
      rejectedStart = error;
    }
    return create(input);
  };
  await autoBuildCommand.run(ctx, {});
  expect(rejectedStart).toBeInstanceOf(Error);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
  ctx.sessions.create = create;
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "New run" });
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(2);
  expect(prompts[1]!.sessionId).not.toBe(prompts[0]!.sessionId);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: true,
    supervisor: { id: prompts[1]!.sessionId },
  });
});
