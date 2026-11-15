import { parentPort } from "node:worker_threads";
import { currentFileMutationWorker } from "./file-mutation-worker";

parentPort!.postMessage(currentFileMutationWorker());
parentPort!.on("message", () => {});
