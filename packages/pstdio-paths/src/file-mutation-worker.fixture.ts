import { parentPort } from "node:worker_threads";
import { currentFileMutationWorker } from "./file-mutation-worker";

parentPort!.on("message", () => {
  parentPort!.postMessage(currentFileMutationWorker());
});
