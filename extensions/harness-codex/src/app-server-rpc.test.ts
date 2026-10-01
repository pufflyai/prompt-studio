import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createAppServerRpc } from "./app-server-rpc";

test("closes the RPC connection when a live peer closes its stdout pipe", async () => {
  const child = spawn("node", [fileURLToPath(new URL("./app-server-fixture.ts", import.meta.url))], {
    stdio: "pipe",
    env: { ...process.env, PSTDIO_TEST_MODE: "close" },
  });
  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  const rpc = createAppServerRpc(
    { stdin: child.stdin!, stdout: child.stdout!, stderr: child.stderr!, kill: () => void child.kill(), onExit },
    () => {},
  );
  try {
    await rpc.request("initialize", {});
    await rpc.request("thread/start", {});
    await rpc.request("turn/start", {});

    expect(await Promise.race([rpc.finished.then(() => true), Bun.sleep(500).then(() => false)])).toBe(true);
    expect(child.exitCode).toBeNull();
  } finally {
    child.kill();
    await onExit;
  }
});
