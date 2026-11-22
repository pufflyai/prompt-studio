import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./local-cli";

test("CLI output keeps characters that span output chunks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cloud-local-cli-"));
  const binary = join(directory, "pocketcoder");
  // Write the two bytes of "é" in separate chunks on both streams.
  await writeFile(
    binary,
    "#!/bin/sh\nprintf '\\303'; printf '\\303' >&2; sleep 0.2; printf '\\251'; printf '\\251' >&2\n",
    { mode: 0o755 },
  );
  try {
    expect(await runCli(binary, directory, {}, [])).toEqual({ exitCode: 0, stdout: "é", stderr: "é" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
