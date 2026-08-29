// Helper for extension-process-api.test.ts: spawns a detached process, prints its pid,
// and exits naturally. If the child kept the event loop alive, this process would hang.
import { createProcessApi } from "./extension-process-api";

const api = createProcessApi();
const { pid } = await api.spawnDetached({ command: ["sleep", "30"] });
console.log(String(pid ?? ""));
