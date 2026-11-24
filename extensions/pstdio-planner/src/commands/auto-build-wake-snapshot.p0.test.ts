import { expect, test } from "bun:test";
import { autoBuildCommand } from "./auto-build";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { autoBuildScopeCommand } from "./auto-build-scope";
import { supervisorFixture } from "./auto-build-supervisor.fixture";

test("saving all scoped candidates does not wake an unchanged supervisor with active work", async () => {
  const f = await supervisorFixture(3);
  const active = await f.ticket("Active task");
  const next = await f.ticket("Next task");
  const later = await f.ticket("Later task");
  await autoBuildCommand.run(f.ctx, {});
  const supervisorId = f.prompts[0]!.sessionId;
  await autoBuildDispatchCommand.run(f.ctx, { ticket: active.id, revision: "test" });
  const scope = await autoBuildScopeCommand.run(f.ctx, { revision: "test", queries: [{}] });
  expect(new Set(scope.tickets.map(({ id }) => id))).toEqual(new Set([next.id, later.id]));
  const prompts = f.prompts.length;
  f.sessions.get(supervisorId)!.status = "completed";
  expect(await autoBuildCommand.run(f.ctx, {})).toMatchObject({ prompted: false });
  expect(f.prompts).toHaveLength(prompts);
});
