import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("packaged tests honor the selected binary while isolating the runtime environment", () => {
  const root = resolve(import.meta.dirname, "../../../..");
  const directory = mkdtempSync(join(tmpdir(), "pstdio-test-environment-"));
  const binary = join(directory, "selected-binary");
  const probe = join(directory, "environment.test.ts");
  writeFileSync(
    probe,
    `import { expect, test } from "bun:test";
import { PACKAGED_BINARY_PATH } from ${JSON.stringify(join(root, "packages/e2e/src/packaged/packaged-helpers.ts"))};
test("isolated packaged runner", () => {
  expect(PACKAGED_BINARY_PATH).toBe(${JSON.stringify(binary)});
  expect(process.env.E2E_REQUIRE_WEBVIEW_BROWSERS).toBe("1");
  expect(process.env.PSTDIO_API_URL).toBeUndefined();
  expect(process.env.PSTDIO_HOME).not.toBe(${JSON.stringify(directory)});
});
`,
  );
  try {
    const result = spawnSync(process.execPath, ["test", probe], {
      cwd: join(root, "packages/e2e"),
      encoding: "utf8",
      env: {
        ...process.env,
        E2E_PACKAGED_BINARY_PATH: binary,
        E2E_REQUIRE_WEBVIEW_BROWSERS: "1",
        PSTDIO_API_URL: "http://developer-runtime.invalid",
        PSTDIO_HOME: directory,
      },
    });
    expect({ status: result.status, output: result.stderr }).toMatchObject({ status: 0 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
