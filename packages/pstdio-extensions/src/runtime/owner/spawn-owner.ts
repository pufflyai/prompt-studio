import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isPackagedRuntime } from "pstdio-paths";
import { createExtensionProcessEnvironment } from "../process-environment";
import type { OwnerMessage } from "./protocol";
import { observeOwnerProcess } from "./resource-observer";

export const spawnExtensionOwner = (
  root: string,
  runtime: { executable: string; packaged: boolean } | undefined,
  receive: (message: OwnerMessage) => void,
) => {
  const packaged = runtime?.packaged ?? isPackagedRuntime();
  const args = packaged
    ? ["--pstdio-extension-owner"]
    : [
        "--no-env-file",
        join(dirname(fileURLToPath(import.meta.resolve("pstdio-extensions"))), "runtime/owner/entry.ts"),
      ];
  const child = Bun.spawn([runtime?.executable ?? process.execPath, ...args], {
    env: createExtensionProcessEnvironment(process.env, { PSTDIO_HOME: root }),
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
    detached: process.platform !== "win32",
    serialization: "json",
    ipc: receive,
  });
  observeOwnerProcess(child);
  return child;
};
