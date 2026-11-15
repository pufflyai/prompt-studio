import { availableParallelism } from "node:os";
import { startPreparationWorker } from "pstdio-extensions/preparation-server";
import { buildExtensionWebview, withExtensionWebviewBuildSlot } from "./extension-webview-builder";
import { prepareWebviewArtifact, prepareWebviewArtifacts } from "./prepared-webview";
import { inspectWebviewDependencyInputs } from "./webview-input-inspection";

startPreparationWorker(async (_task, data) => {
  const { batch, input, queued } = data as {
    queued?: boolean;
    batch: boolean;
    input: Parameters<typeof prepareWebviewArtifact>[0];
  };
  if (queued) {
    const held = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    let count = 0;
    const slots = Math.max(1, Math.min(4, availableParallelism()));
    const blockers = Array.from({ length: slots }, () =>
      withExtensionWebviewBuildSlot(async () => {
        if (++count === slots) entered.resolve();
        await held.promise;
      }),
    );
    await entered.promise;
    const controller = new AbortController();
    const inspection = inspectWebviewDependencyInputs(input.packagePath, [input.entryPath], controller.signal);
    const build = buildExtensionWebview({
      entryPath: input.entryPath,
      outdir: `${input.packagePath}/out`,
      signal: controller.signal,
    }).then((result) => {
      if (!result.success) throw new Error(result.details);
      return result;
    });
    controller.abort(new Error("Cancelled while waiting for a child slot."));
    held.resolve();
    await Promise.all(blockers);
    return Promise.all(
      [inspection, build].map((work) =>
        work.then(
          () => "accepted",
          (error: Error) => error.message,
        ),
      ),
    );
  }
  const prepare = (signal: AbortSignal) =>
    batch ? prepareWebviewArtifacts([input], signal) : prepareWebviewArtifact(input, signal);
  await prepare(new AbortController().signal);
  const controller = new AbortController();
  const pending = prepare(controller.signal).then(
    () => "accepted",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );
  controller.abort(new Error("Cancelled while inspecting cached frontend."));
  return pending;
});
