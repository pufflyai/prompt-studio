import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("preference forms retain visible drafts through pending/failed saves, scope their owner and guard leaving", async () => {
  const child = Bun.spawn(
    [process.execPath, fileURLToPath(new URL("./preference-form.fixture.tsx", import.meta.url))],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [code, output, errors] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(code, errors).toBe(0);
  expect(output).toContain("preference form scenarios passed");
});
