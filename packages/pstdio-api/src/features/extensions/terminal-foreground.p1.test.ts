import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { readTerminalForeground } from "./terminal-foreground";

const posixOnlyTest = process.platform === "win32" ? test.skip : test;

describe("terminal foreground probe", () => {
  let child: ReturnType<typeof Bun.spawn> | undefined;

  afterEach(async () => {
    child?.kill("SIGKILL");
    await child?.exited;
    child?.terminal?.close();
    child = undefined;
  });

  // The probe runs every second for each open terminal, so it must never block the API event loop.
  posixOnlyTest.each([
    { command: ["/bin/sleep", "5"], name: "sleep" },
    {
      command: ["/bin/bash", "-c", "exec -a foreground-alias /bin/sleep 5"],
      name: process.platform === "darwin" ? "foreground-alias" : "sleep",
    },
  ])("reads the PTY foreground $name without blocking the event loop", async ({ command, name }) => {
    child = Bun.spawn([...command], { terminal: { cols: 80, rows: 24 } });
    const spawn = spyOn(Bun, "spawn");
    const spawnSync = spyOn(Bun, "spawnSync");
    try {
      const probe = readTerminalForeground(child.pid);
      let foreground = await probe;
      for (let attempt = 0; attempt < 20 && foreground?.name !== name; attempt += 1) {
        await Bun.sleep(25);
        foreground = await readTerminalForeground(child.pid);
      }

      expect(foreground).toEqual({ group: child.pid, name });
      expect(spawn).not.toHaveBeenCalled();
      expect(spawnSync).not.toHaveBeenCalled();
    } finally {
      spawn.mockRestore();
      spawnSync.mockRestore();
    }
  });

  test("returns null for a process that does not exist", async () => {
    await expect(readTerminalForeground(2 ** 22 + 12345)).resolves.toBeNull();
  });
});
