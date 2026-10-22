import { executeBinaryTask } from "./binary-task";
import type { BinaryTask } from "./binary-task-types";

declare const self: Worker;
self.onmessage = (event: MessageEvent<{ id: number; task: BinaryTask }>) => {
  const { id, task } = event.data;
  try {
    self.postMessage({ id, result: executeBinaryTask(task) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
