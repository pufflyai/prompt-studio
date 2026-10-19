import { expect, test } from "bun:test";
import { autoBuildCommand } from "./auto-build";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { selectAutoBuildModelCommand } from "./auto-build-model";

const supervisor = { harnessId: "pstdio.harness-codex.harness.codex", model: "test-model", params: { effort: "high" } };

test("choosing a supervisor model leaves Auto Build stopped", async () => {
  const { ctx } = await fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  await selectAutoBuildModelCommand.run(ctx, { supervisorModel: supervisor });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false, supervisorModel: supervisor });
});

test("remembers the supervisor model when Auto Build stops and restarts", async () => {
  const { ctx } = await fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: false, supervisorModel: supervisor });
  await configureAutoBuildCommand.run(ctx, { enabled: true });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ supervisorModel: supervisor });
});

test("starts the supervisor with the chosen model and run options", async () => {
  const { ctx, ticket } = await fixture();
  await ticket("Build the greeting");
  await configureAutoBuildCommand.run(ctx, { enabled: true, supervisorModel: supervisor });
  const starts: Parameters<typeof ctx.sessions.create>[0][] = [];
  const create = ctx.sessions.create;
  ctx.sessions.create = async (input) => {
    starts.push(input);
    return create(input);
  };
  await autoBuildCommand.run(ctx, {});
  expect(starts).toHaveLength(1);
  expect(starts[0]?.harness).toEqual(supervisor);
});
