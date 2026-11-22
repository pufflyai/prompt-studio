import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./local-cli";

test("controller output preserves Unicode split across stdout and stderr chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "pc-cli-encoding-"));
  const script = join(root, "emit.ts");
  await writeFile(join(root, "empty.env"), "");
  await writeFile(
    script,
    `
const bytes = Buffer.from("é雪");
for (const stream of [process.stdout, process.stderr]) {
  stream.write(bytes.subarray(0, 1));
  await Bun.sleep(20);
  stream.write(bytes.subarray(1, 3));
  await Bun.sleep(20);
  stream.write(bytes.subarray(3));
}
`,
  );
  try {
    const result = await runCli(process.execPath, root, {}, [script]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("é雪");
    expect(result.stderr).toBe("é雪");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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
