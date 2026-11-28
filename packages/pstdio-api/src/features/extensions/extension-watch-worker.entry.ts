import { traceSetupPhase } from "../../lib/setup-phase";
import type { WatchReply, WatchRequest } from "./extension-watch-process";
import { disposePreparationWatcher, updatePreparationWatcher } from "./preparation-watchers";

export const runExtensionWatchWorker = () => {
  if (!process.send) throw new Error("Extension watch worker requires an IPC channel.");
  const send = (reply: WatchReply) => process.send!(reply);
  let work = Promise.resolve();
  process.on("message", (request: WatchRequest) => {
    work = work.then(async () => {
      try {
        if (request.task === "watch.update") {
          await traceSetupPhase("extension.preparation", { task: request.task }, () =>
            updatePreparationWatcher(request.input, (event) => send({ event })),
          );
        } else {
          disposePreparationWatcher(request.input.id);
        }
        send({ id: request.id });
      } catch (error) {
        send({ id: request.id, error: error instanceof Error ? error.message : String(error) });
      }
    });
  });
  process.once("disconnect", () => process.exit(0));
};

if (import.meta.main) runExtensionWatchWorker();
