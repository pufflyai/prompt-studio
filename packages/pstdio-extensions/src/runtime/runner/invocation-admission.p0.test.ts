import { expect, test } from "bun:test";
import { MAX_CONCURRENT_INVOCATIONS_PER_EXTENSION } from "./invocation-admission";
import { makeRunner } from "./runner.test-fixture";

test("an extension at its command limit gets a retryable overload rejection until its work settles", async () => {
  const release = Promise.withResolvers<void>();
  const runner = makeRunner({
    commands: [
      {
        id: "wait",
        ref: { kind: "command", id: "wait" },
        title: "Wait",
        run: () => release.promise.then(() => "done"),
      },
    ],
  });
  const execute = () => runner.execute({ commandId: "pstdio.lab.command.wait", projectId: "p1", source: "cli" });

  const running = Array.from({ length: MAX_CONCURRENT_INVOCATIONS_PER_EXTENSION }, execute);
  const rejected = await execute();
  expect(rejected).toMatchObject({
    ok: false,
    status: "rejected",
    code: "extension_overloaded",
    diagnostics: [{ code: "extension_overloaded", extensionId: "pstdio.lab", metadata: { retryAfterMs: 1000 } }],
  });

  release.resolve();
  expect((await Promise.all(running)).every((outcome) => outcome.ok)).toBe(true);
  expect(await execute()).toMatchObject({ ok: true, value: "done" });
});

test("nested commands share their caller's admission", async () => {
  const release = Promise.withResolvers<void>();
  const runner = makeRunner({
    commands: [
      {
        id: "inner",
        ref: { kind: "command", id: "inner" },
        title: "Inner",
        run: async () => "inner",
      },
      {
        id: "outer",
        ref: { kind: "command", id: "outer" },
        title: "Outer",
        async run(ctx) {
          await release.promise;
          return ctx.commands.execute({ kind: "command", id: "inner" }, { params: {} });
        },
      },
    ],
  });
  const running = Array.from({ length: MAX_CONCURRENT_INVOCATIONS_PER_EXTENSION }, () =>
    runner.execute({ commandId: "pstdio.lab.command.outer", projectId: "p1", source: "cli" }),
  );
  release.resolve();
  const outcomes = await Promise.all(running);
  expect(outcomes.every((outcome) => outcome.ok && (outcome.value as { ok: boolean }).ok)).toBe(true);
});

test("cancelling a command that ignores cancellation frees its slot", async () => {
  const never = new Promise<string>(() => {});
  const runner = makeRunner({
    commands: [{ id: "stuck", ref: { kind: "command", id: "stuck" }, title: "Stuck", run: () => never }],
  });
  const controllers = Array.from({ length: MAX_CONCURRENT_INVOCATIONS_PER_EXTENSION }, () => new AbortController());
  for (const controller of controllers)
    void runner.execute({ commandId: "pstdio.lab.command.stuck", projectId: "p1", signal: controller.signal });
  const execute = () => runner.execute({ commandId: "pstdio.lab.command.stuck", projectId: "p1" });
  expect(await execute()).toMatchObject({ code: "extension_overloaded" });
  for (const controller of controllers) controller.abort();
  expect(await Promise.race([execute(), Bun.sleep(20).then(() => "running")])).toBe("running");
});
