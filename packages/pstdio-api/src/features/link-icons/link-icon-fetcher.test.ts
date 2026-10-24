import { expect, test } from "bun:test";
import { join } from "node:path";

test("an expired icon lookup returns a miss without an unhandled DNS rejection", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `import { createLinkIconFetcher } from ${JSON.stringify(join(import.meta.dir, "link-icon-fetcher.ts"))};
      const fetcher = createLinkIconFetcher({ timeoutMs: 0 });
      const icon = await fetcher.get("https://pstdio-offline-" + crypto.randomUUID() + ".invalid");
      if (icon !== null) process.exitCode = 2;`,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [exitCode, errors] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect(errors).toBe("");
  expect(exitCode).toBe(0);
});
