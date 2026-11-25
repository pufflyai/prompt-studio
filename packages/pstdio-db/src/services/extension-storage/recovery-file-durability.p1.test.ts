import { expect, test } from "bun:test";
import { join } from "node:path";

for (const interruptedAfter of ["mkdir", "rename"])
  test(`recovery files durably link every parent on retry after interrupted ${interruptedAfter}`, async () => {
    const child = Bun.spawn(
      [process.execPath, join(import.meta.dirname, "recovery-files-durability.fixture.ts"), interruptedAfter],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [output, errors, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ errors, exitCode }).toEqual({ errors: "", exitCode: 0 });
    expect(JSON.parse(output)).toEqual({ interruptedAfter, verified: true, flushedParents: 6 });
  });
