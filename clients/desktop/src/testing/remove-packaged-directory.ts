import { rm } from "node:fs/promises";

// ADR 0029: Node 24's synchronous Windows removal does not honor these retries.
export const removePackagedDirectory = (path: string) =>
  rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
