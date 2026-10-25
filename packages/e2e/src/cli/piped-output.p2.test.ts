import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { cleanupDirs, createTempDir, PSTDIO_CLI } from "./helpers";
import { TEST_TIMEOUT } from "./timeouts";

const PIPE_BUFFER_BYTES = 64 * 1024;
const dirs: string[] = [];

afterAll(() => {
  cleanupDirs(dirs);
});

// Many commands make the check report larger than one pipe buffer.
const writeLargeExtension = (input: { invalidId: boolean }) => {
  const source = join(createTempDir(), "large-extension");
  dirs.push(source);
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "large-extension",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  const ids = Array.from({ length: 400 }, (_, index) => `large.command-${index}`);
  if (input.invalidId) ids.push("Large.Invalid_Id");
  const commands = ids.map((id) => ({ id, ref: { kind: "command", id }, title: `Command ${id}` }));
  writeFileSync(
    join(source, "extension.ts"),
    `export default { commands: ${JSON.stringify(commands)}.map((command) => ({ ...command, run: async () => null })) };`,
  );
  return source;
};

// The consumer waits before it reads, like `tee` writing to a slow disk, so the pipe fills up.
// A correct CLI waits for the reader; one that drops output has already exited by then.
const PIPELINE = '{ bun run "$0" extensions check "$1" --json; echo $? > "$2"; } | { sleep 1; cat > "$3"; }';

const checkThroughPipe = (source: string) => {
  const home = createTempDir();
  dirs.push(home);
  const exitCodePath = join(home, "exit-code");
  const outputPath = join(home, "piped.json");
  spawnSync("sh", ["-c", PIPELINE, PSTDIO_CLI, source, exitCodePath, outputPath], {
    cwd: home,
    env: {
      ...process.env,
      PSTDIO_HOME: home,
      PSTDIO_DISABLE_API_AUTO_START: "1",
      PSTDIO_DISABLE_EMBED_MANIFEST: "1",
    },
    timeout: TEST_TIMEOUT,
  });
  return { exitCode: Number(readFileSync(exitCodePath, "utf8")), stdout: readFileSync(outputPath, "utf8") };
};

describe("piped CLI output", () => {
  test(
    "delivers a complete JSON result larger than a pipe buffer",
    () => {
      const result = checkThroughPipe(writeLargeExtension({ invalidId: false }));

      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(PIPE_BUFFER_BYTES);
      expect(JSON.parse(result.stdout).check.errorCount).toBe(0);
    },
    TEST_TIMEOUT,
  );

  test(
    "delivers the complete JSON result before exiting with a failure code",
    () => {
      const result = checkThroughPipe(writeLargeExtension({ invalidId: true }));

      expect(result.exitCode).toBe(1);
      expect(result.stdout.length).toBeGreaterThan(PIPE_BUFFER_BYTES);
      expect(JSON.parse(result.stdout).check.errorCount).toBeGreaterThan(0);
    },
    TEST_TIMEOUT,
  );
});
