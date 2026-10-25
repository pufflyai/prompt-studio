import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { readTerminalForeground } from "./terminal-foreground";

const posixOnlyTest = process.platform === "win32" ? test.skip : test;

describe("terminal foreground probe", () => {
  let child: ReturnType<typeof Bun.spawn> | undefined;

  afterEach(() => {
    child?.kill("SIGKILL");
    child = undefined;
  });

  // The probe runs every second for each open terminal, so it must never block the API event loop.
  posixOnlyTest("reads the PTY foreground program without blocking the event loop", async () => {
    child = Bun.spawn(["/bin/sleep", "5"], { terminal: { cols: 80, rows: 24 } });
    const spawnSync = spyOn(Bun, "spawnSync");
    try {
      const probe = readTerminalForeground(child.pid);
      expect(probe).toBeInstanceOf(Promise);

      let foreground = await probe;
      for (let attempt = 0; attempt < 20 && foreground?.name !== "sleep"; attempt += 1) {
        await Bun.sleep(25);
        foreground = await readTerminalForeground(child.pid);
      }

      expect(foreground).toEqual({ group: child.pid, name: "sleep" });
      expect(spawnSync).not.toHaveBeenCalled();
    } finally {
      spawnSync.mockRestore();
    }
  });

  test("returns null for a process that does not exist", async () => {
    await expect(readTerminalForeground(2 ** 22 + 12345)).resolves.toBeNull();
  });
});
