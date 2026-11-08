import { rmSync } from "node:fs";
import { rm } from "node:fs/promises";

export const removeTestDirectory = async (path: string) => {
  const options = { recursive: true, force: true, maxRetries: 5, retryDelay: 100 };
  // ADR 0039: Node 24's synchronous Windows removal does not honor these retries.
  if (process.platform === "win32") await rm(path, options);
  // Native POSIX traversal avoids scheduling a JavaScript callback for every dependency file.
  else rmSync(path, options);
};
