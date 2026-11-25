import { expect, test } from "bun:test";
import { attemptId } from "../data/attempt-identity";
import { readTicketAttempts } from "../data/attempt-queries";
import { autoBuildDispatches } from "../data/auto-build-dispatches";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor, saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { fixture } from "./auto-build.fixture";
import { waitingPage } from "./auto-build-candidate-pages.fixture";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";

test("a later-page wake refresh failure preserves the successful dispatch and receipt", async () => {
  const f = await waitingPage();
  let started = false;
  const create = f.ctx.sessions.create;
  f.ctx.sessions.create = async (input) => {
    const session = await create(input);
    started = true;
    return session;
  };
  const query = f.storage.records.query.bind(f.storage.records);
  f.storage.records.query = async (input) => {
    if (started && input.index === "ticket-view" && input.offset === 100 && input.fields?.includes("gate"))
      throw new Error("Work scope changed during the wake refresh");
    return query(input);
  };
  const outcome = await Promise.resolve(
    autoBuildDispatchCommand.run(f.ctx, { ticket: "ticket-100", revision: "test" }),
  ).then(
    (value) => ({ value }),
    (error: unknown) => ({ error: String(error) }),
  );
  expect(started).toBe(true);
  const attempts = await readTicketAttempts(f.storage, ["ticket-100"]);
  expect(attempts).toHaveLength(1);
  const owner = await readAutoBuildSupervisor(f.ctx);
  expect(await autoBuildDispatches(f.ctx, owner.sessionId!).get(attemptId(attempts[0]!))).toBeDefined();
  expect(outcome).toMatchObject({ value: { decision: "started" } });
}, 10_000);

test("pausing during the wake refresh does not stamp the old mode snapshot", async () => {
  const f = await fixture();
  const task = await f.ticket("Start before pausing");
  await saveAutoBuildSupervisor(f.ctx, { sessionId: "fixture-supervisor", lastWake: "keep" });
  let started = false;
  let paused = false;
  const create = f.ctx.sessions.create;
  f.ctx.sessions.create = async (input) => {
    const session = await create(input);
    started = true;
    return session;
  };
  const query = f.storage.records.query.bind(f.storage.records);
  f.storage.records.query = async (input) => {
    const result = await query(input);
    if (started && !paused && input.index === "ticket-view" && input.fields?.includes("gate")) {
      paused = true;
      await f.storage.set("auto-build", { ...(await readAutoBuildMode(f.ctx)), state: "paused" });
    }
    return result;
  };
  expect(await autoBuildDispatchCommand.run(f.ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "started",
  });
  expect(paused).toBe(true);
  expect((await readAutoBuildMode(f.ctx)).state).toBe("paused");
  expect((await readAutoBuildSupervisor(f.ctx)).lastWake).toBe("keep");
});
