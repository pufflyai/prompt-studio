import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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

interface FixtureOptions {
  confirm?: () => Promise<boolean>;
  authorize?: (script: string) => Promise<boolean>;
}

const unexpected = async (): Promise<boolean> => {
  throw new Error("Unexpected prompt");
};

const fixture = ({ confirm = unexpected, authorize = unexpected }: FixtureOptions = {}) => {
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
    confirm,
    authorize,
  });
  return { root, binary, command, installation };
};

test.skipIf(process.platform === "win32")(
  "makes pst executable on the first offer and keeps existing setup on later offers",
  async () => {
    const { installation, command } = fixture();
    expect(await installation.offerOnce()).toBe("installed");
    expect(spawnSync(command, ["--version"]).status).toBe(0);
    expect(await installation.offerOnce()).toBeNull();
    expect(await installation.install()).toBe("installed");
  },
);

test.skipIf(process.platform === "win32")("preserves an independently installed command", async () => {
  const { installation, command } = fixture();
  writeFileSync(command, "independent CLI");
  expect(await installation.offerOnce()).toBe("conflict");
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
      confirm: unexpected,
      authorize: unexpected,
    });
    expect(await installation.install()).toBe("installed");
    expect(spawnSync(command, ["--version"]).status).toBe(0);
  },
);

// A read-only command folder stands in for /usr/local/bin, which needs the person's password.
const runScript = (command: string) => async (script: string) => {
  chmodSync(dirname(command), 0o755);
  expect(spawnSync("/bin/sh", ["-c", script], { encoding: "utf8" }).status).toBe(0);
  return true;
};

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "asks before the password prompt and does nothing when the person says not now",
  async () => {
    const asked: string[] = [];
    const { installation, command } = fixture({
      confirm: async () => {
        asked.push("confirm");
        return false;
      },
    });
    chmodSync(dirname(command), 0o555);

    expect(await installation.offerOnce()).toBe("declined");
    expect(asked).toEqual(["confirm"]);
    expect(existsSync(command)).toBe(false);
  },
);

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "asks for the password only after the person agrees",
  async () => {
    const asked: string[] = [];
    const { installation, command } = fixture({
      confirm: async () => {
        asked.push("confirm");
        return true;
      },
      authorize: async (script) => {
        asked.push("authorize");
        return runScript(command)(script);
      },
    });
    chmodSync(dirname(command), 0o555);

    expect(await installation.offerOnce()).toBe("installed");
    expect(asked).toEqual(["confirm", "authorize"]);
    expect(spawnSync(command, ["--version"]).status).toBe(0);
  },
);

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "does not offer again after a decline, and installs from the menu",
  async () => {
    const answers = [false, true];
    let passwordPrompts = 0;
    const { installation, command } = fixture({
      confirm: async () => answers.shift()!,
      authorize: async (script) => {
        passwordPrompts++;
        return runScript(command)(script);
      },
    });
    chmodSync(dirname(command), 0o555);

    expect(await installation.offerOnce()).toBe("declined");
    expect(await installation.offerOnce()).toBeNull();
    expect(passwordPrompts).toBe(0);
    expect(await installation.install()).toBe("installed");
    expect(passwordPrompts).toBe(1);
  },
);

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "treats a cancelled password prompt as a decline",
  async () => {
    const { installation, command } = fixture({ confirm: async () => true, authorize: async () => false });
    chmodSync(dirname(command), 0o555);

    expect(await installation.install()).toBe("declined");
    expect(existsSync(command)).toBe(false);
    expect(await installation.offerOnce()).toBeNull();
  },
);
