import { spawn, spawnSync } from "node:child_process";
import { on, once } from "node:events";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { removeTestDirectory } from "../testing/remove-test-directory";

const require = createRequire(import.meta.url);

// Critical: a failed preload must not leave every recovery action behind its unavailable bridge.
test("the real desktop offers native recovery and logs when its preload cannot initialize", async () => {
  const root = mkdtempSync(join(tmpdir(), "desktop-native-recovery-"));
  const profile = join(root, "profile");
  mkdirSync(profile);
  cpSync(join(import.meta.dirname, "../../dist/renderer"), join(root, "renderer"), { recursive: true });
  writeFileSync(join(root, "preload.cjs"), 'throw new Error("Fixture desktop bridge unavailable");');
  const main = join(root, "app-main.mjs");
  const entry = join(root, "fixture.mjs");
  try {
    for (const [source, output] of [
      [join(import.meta.dirname, "../main.ts"), main],
      [join(import.meta.dirname, "native-recovery-fixture.ts"), entry],
    ]) {
      const built = spawnSync("bun", [
        "build",
        source!,
        "--outfile",
        output!,
        "--target=node",
        "--format=esm",
        "--external=electron",
      ]);
      expect(built.status, built.stderr.toString()).toBe(0);
    }
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined && !/^(PSTDIO_|E2E_|CI_|GITHUB_|NX_)/.test(entry[0]),
      ),
    );
    delete env.ELECTRON_RUN_AS_NODE;
    const application = spawn(require("electron") as string, [entry], {
      env: {
        ...env,
        PSTDIO_HOME: join(root, "home"),
        PSTDIO_NATIVE_TEST_PROFILE: profile,
        PSTDIO_NATIVE_TEST_MAIN: main,
      },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    const messages = on(application, "message", { close: ["exit"] });
    const next = async () => {
      const value = (await messages.next()).value?.[0];
      if (!value || value.fixtureError) throw new Error(value?.fixtureError ?? "Desktop exited before recovery");
      return value;
    };
    try {
      const prompt = await next();
      expect(prompt.nativePrompt).toBe(true);
      expect(prompt.buttons).toBeGreaterThanOrEqual(2);
      const logs = prompt.buttons === 3 ? 1 : 0;
      application.send(logs);
      expect(await next()).toEqual({ logsOpened: true, privatePath: true });
      const again = await next();
      expect(again.nativePrompt).toBe(true);
      const exited = once(application, "exit");
      application.send(again.cancelId);
      expect((await exited)[0]).toBe(0);
    } finally {
      await messages.return?.();
      if (application.exitCode === null && application.signalCode === null) {
        const exited = once(application, "exit");
        application.kill("SIGTERM");
        await exited;
      }
    }
  } finally {
    await removeTestDirectory(root);
  }
});
