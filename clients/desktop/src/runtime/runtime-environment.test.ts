import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRuntimeEnvironment } from "./runtime-environment";

test("preserves the inherited Windows environment", async () => {
  const env = { PATH: "C:\\tools;C:\\Windows", PSTDIO_HOME: "C:\\runtime", SHELL: "/missing-shell" };
  expect(await resolveRuntimeEnvironment(new AbortController().signal, env, "win32")).toEqual(env);
});

test.skipIf(process.platform === "win32")("reports a shell that cannot start", async () => {
  await expect(resolveRuntimeEnvironment(new AbortController().signal, { SHELL: "/missing-shell" })).rejects.toThrow(
    "Could not load the executable search path from /missing-shell",
  );
});

test.skipIf(process.platform === "win32")("cancels shell startup with the runtime startup signal", async () => {
  const home = mkdtempSync(join(tmpdir(), "desktop-shell-cancel-"));
  writeFileSync(join(home, ".bash_profile"), "exec /bin/sleep 30\n");
  const controller = new AbortController();
  const reason = new Error("Runtime startup cancelled");
  const cancellation = setTimeout(() => controller.abort(reason), 50);
  try {
    await expect(
      resolveRuntimeEnvironment(controller.signal, { ...process.env, HOME: home, SHELL: "/bin/bash" }),
    ).rejects.toBe(reason);
  } finally {
    clearTimeout(cancellation);
    rmSync(home, { recursive: true, force: true });
  }
});
