import { startPreparationWorker } from "./preparation-server";
import { handleRuntimePreparation } from "./preparation-tasks";

export { runtimePreparationTasks } from "./preparation-tasks";

startPreparationWorker(handleRuntimePreparation);
