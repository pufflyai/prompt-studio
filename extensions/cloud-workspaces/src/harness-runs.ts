import type { HarnessContext, HarnessSession } from "@pstdio/sdk/extensions";

export function createHarnessRuns() {
  const active = new Set<{ projectId?: string; controller: AbortController; settled: Promise<void> }>();
  return {
    run<Input extends { signal?: AbortSignal }>(
      ctx: HarnessContext,
      input: Input,
      start: (input: Input) => Promise<HarnessSession>,
    ) {
      const controller = new AbortController();
      const signal = input.signal ? AbortSignal.any([input.signal, controller.signal]) : controller.signal;
      const started = start({ ...input, signal });
      const settled = started
        .then((session) => session.done)
        .then(
          () => {},
          () => {},
        );
      const run = { projectId: ctx.projectId, controller, settled };
      active.add(run);
      void settled.then(() => active.delete(run));
      return started;
    },
    async dispose(ctx: HarnessContext) {
      const runs = [...active].filter((run) => run.projectId === ctx.projectId);
      for (const run of runs) run.controller.abort();
      await Promise.all(runs.map((run) => run.settled));
    },
  };
}
