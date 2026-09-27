import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "./default-extensions";

const readManifest = (dir: string) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

test("e2e declares every extension it installs as a devDependency", () => {
  const { defaultExtensions } = JSON.parse(PSTDIO_E2E_DEFAULT_EXTENSIONS) as {
    defaultExtensions: Array<{ source: string }>;
  };
  const devDependencies = Object.keys(readManifest(join(import.meta.dir, "..")).devDependencies);

  for (const { source } of defaultExtensions) expect(devDependencies).toContain(readManifest(source).name);
});
