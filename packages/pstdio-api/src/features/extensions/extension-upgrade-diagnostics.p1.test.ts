import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Allow for Windows Git and API setup under CI load.
const windows = process.platform === "win32";
const fixtureTimeoutMs = windows ? 45_000 : 12_000;
const testTimeoutMs = windows ? 55_000 : 15_000;

const runUpgrade = async (source: string) => {
  const root = await mkdtemp(join(tmpdir(), "extension-upgrade-diagnostics-"));
  const failures: unknown[] = [];
  try {
    // Bun-launched Git commands inherit the launch environment. Give each fixture its own config.
    const deadline = AbortSignal.timeout(fixtureTimeoutMs);
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
        signal: deadline,
      },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    const output = stdout + stderr;
    expect(exitCode, deadline.aborted ? `Upgrade fixture exceeded ${fixtureTimeoutMs} ms.\n${output}` : output).toBe(0);
  } catch (error) {
    failures.push(error);
  }
  try {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 1)
    throw new AggregateError(failures, "Diagnostics upgrade and fixture cleanup failed.", { cause: failures[0] });
  if (failures.length === 1) throw failures[0];
};

test(
  "a renamed catalog Git install can capture diagnostics after a changed release upgrade",
  () => runUpgrade("host-release"),
  testTimeoutMs,
);

test(
  "a renamed catalog Git install at an arbitrary ref gains trust only after installing the host release",
  () => runUpgrade("arbitrary-ref"),
  testTimeoutMs,
);

test(
  "a renamed Git install from an overridden catalog's foreign repository cannot capture diagnostics",
  () => runUpgrade("foreign-catalog"),
  testTimeoutMs,
);

test(
  "a named catalog Git upgrade using the host release tag retains diagnostics access",
  () => runUpgrade("named-release"),
  testTimeoutMs,
);

test(
  "a named catalog Git upgrade using a different configured ref cannot capture diagnostics",
  () => runUpgrade("named-override"),
  testTimeoutMs,
);
