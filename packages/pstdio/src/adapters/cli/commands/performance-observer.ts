import { runProcessObserver } from "@/features/performance/process-observer";

export const command = "performance-observer";
export const describe = false;
export const handler = runProcessObserver;
