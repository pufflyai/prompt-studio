import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runUpgrade = async (source: string) => {
  const root = await mkdtemp(join(tmpdir(), "extension-upgrade-diagnostics-"));
  try {
    // Bun-launched Git commands inherit the launch environment. Give each fixture its own config.
    const child = Bun.spawn(
      [process.execPath, join(import.meta.dir, "extension-upgrade-diagnostics.fixture.ts"), root, source],
      {
        env: {
          ...process.env,
          HOME: root,
          USERPROFILE: root,
          XDG_CONFIG_HOME: join(root, "config"),
          GIT_CONFIG_COUNT: "0",
          GIT_CONFIG_GLOBAL: join(root, "gitconfig"),
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_PARAMETERS: "",
          GIT_TERMINAL_PROMPT: "0",
          PSTDIO_DEFAULT_EXTENSIONS: "[]",
          PSTDIO_EXTENSION_CATALOG: "",
          PSTDIO_HOME: join(root, "home"),
          PSTDIO_LOG_LEVEL: "error",
          PSTDIO_LOG_PATH: join(root, "host.log"),
        },
        stdout: "pipe",
        stderr: "pipe",
        signal: AbortSignal.timeout(12_000),
      },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, stdout + stderr).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test(
  "a renamed catalog Git install can capture diagnostics after a changed release upgrade",
  () => runUpgrade("host-release"),
  15_000,
);

test(
  "a renamed catalog Git install at an arbitrary ref gains trust only after installing the host release",
  () => runUpgrade("arbitrary-ref"),
  15_000,
);

test(
  "a renamed Git install from an overridden catalog's foreign repository cannot capture diagnostics",
  () => runUpgrade("foreign-catalog"),
  15_000,
);

test(
  "a named catalog Git upgrade using the host release tag retains diagnostics access",
  () => runUpgrade("named-release"),
  15_000,
);

test(
  "a named catalog Git upgrade using a different configured ref cannot capture diagnostics",
  () => runUpgrade("named-override"),
  15_000,
);
