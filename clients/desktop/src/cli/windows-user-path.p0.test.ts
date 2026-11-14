import { expect, test } from "bun:test";
import { runWindowsPowerShell } from "./windows-user-path";

test.skipIf(process.platform !== "win32")(
  "a cancelled PowerShell command exits before its caller cleans up",
  async () => {
    const controller = new AbortController();
    const command = runWindowsPowerShell("Start-Sleep -Seconds 60", undefined, controller.signal);
    controller.abort();
    await expect(command).rejects.toMatchObject({ name: "AbortError" });
  },
);
