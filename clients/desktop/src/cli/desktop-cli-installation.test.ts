import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DesktopCliInstallation } from "./desktop-cli-installation";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    chmodSync(join(root, "bin"), 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});

const fixture = (
  authorize: (script: string) => Promise<void> = async () => {
    throw new Error("Unexpected authorization");
  },
) => {
  const root = mkdtempSync(join(tmpdir(), "desktop-cli-"));
  roots.push(root);
  const binary = join(root, "Prompt Studio.app", "pstdio");
  const command = join(root, "bin", "pst");
  mkdirSync(dirname(binary), { recursive: true });
  mkdirSync(dirname(command));
  symlinkSync(process.execPath, binary);
  const installation = new DesktopCliInstallation({
    binary,
    command,
    receiptPath: join(root, "user-data", "cli-setup-attempted"),
    authorize,
  });
  return { root, binary, command, installation };
};

test.skipIf(process.platform === "win32")(
  "makes pst executable on first launch and keeps existing setup on later launches",
  async () => {
    const { installation, command } = fixture();
    expect(await installation.onFirstLaunch()).toBe("installed");
    expect(spawnSync(command, ["--version"]).status).toBe(0);
    expect(await installation.onFirstLaunch()).toBeNull();
    expect(await installation.install()).toBe("installed");
  },
);

test.skipIf(process.platform === "win32")("preserves an independently installed command", async () => {
  const { installation, command } = fixture();
  writeFileSync(command, "independent CLI");
  expect(await installation.onFirstLaunch()).toBe("conflict");
  expect(readFileSync(command, "utf8")).toBe("independent CLI");
});

test.skipIf(process.platform === "win32")(
  "resolves the bundled runtime through a linked command directory",
  async () => {
    const { root } = fixture();
    const actual = join(root, "actual", "nested");
    mkdirSync(actual, { recursive: true });
    const linked = join(root, "linked");
    symlinkSync(actual, linked);
    const command = join(linked, "pst");
    const installation = new DesktopCliInstallation({
      binary: process.execPath,
      command,
      receiptPath: join(root, "attempted"),
      authorize: async () => {
        throw new Error("Unexpected authorization");
      },
    });
    expect(await installation.install()).toBe("installed");
    expect(spawnSync(command, ["--version"]).status).toBe(0);
  },
);

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "does not repeat a cancelled authorization prompt and allows an explicit retry",
  async () => {
    let attempts = 0;
    const { installation, command } = fixture(async (script) => {
      attempts++;
      if (attempts === 1) throw new Error("Authorization cancelled");
      chmodSync(dirname(command), 0o755);
      const result = spawnSync("/bin/sh", ["-c", script], { encoding: "utf8" });
      expect(result.status).toBe(0);
    });
    chmodSync(dirname(command), 0o555);
    await expect(installation.onFirstLaunch()).rejects.toThrow("Authorization cancelled");
    expect(await installation.onFirstLaunch()).toBeNull();
    expect(attempts).toBe(1);
    expect(await installation.install()).toBe("installed");
    expect(spawnSync(command, ["--version"]).status).toBe(0);
    expect(attempts).toBe(2);
  },
);

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "does not prompt again after cancelling menu setup during startup",
  async () => {
    let attempts = 0;
    const { installation, command } = fixture(async () => {
      attempts++;
      throw new Error("Authorization cancelled");
    });
    chmodSync(dirname(command), 0o555);
    await expect(installation.install()).rejects.toThrow("Authorization cancelled");
    expect(await installation.onFirstLaunch()).toBeNull();
    expect(attempts).toBe(1);
  },
);
