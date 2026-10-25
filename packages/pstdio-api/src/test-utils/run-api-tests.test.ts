import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("the isolated API driver executes only the explicit PR file selection and writes its evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "api-explicit-selection-"));
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        resolve(import.meta.dirname, "run-api-tests.ts"),
        "--files",
        JSON.stringify(["src/app-config.test.ts"]),
      ],
      {
        cwd: resolve(import.meta.dirname, "../.."),
        env: { ...process.env, API_TEST_REPORT_DIR: directory, CI_PRIORITY: "P1" },
        stdout: "ignore",
        stderr: "ignore",
      },
    );
    expect(await child.exited).toBe(0);
    const result = await Bun.file(join(directory, "results.json")).json();
    expect(result.selected).toEqual(["src/app-config.test.ts"]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].outcome).toBe("success");
    expect(result.files[0].cases.executedCases).toBeGreaterThan(0);
    expect(result.complete).toBe(true);
    expect((await Bun.file(join(directory, "timings.json")).json()).files["src/app-config.test.ts"]).toBeGreaterThan(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
