import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writePagedCollectionFixtures = (root: string) => {
  mkdirSync(root, { recursive: true });
  const bundlePath = join(root, "paged-fixture.js");
  execFileSync("bun", [
    "build",
    join(import.meta.dirname, "fixtures/paged-collection-extension.ts"),
    "--target",
    "bun",
    "--outfile",
    bundlePath,
  ]);
  const bundle = readFileSync(bundlePath);
  const extensions = [];
  for (let owner = 0; owner < 10; owner++) {
    const name = `paged-owner-${owner}`;
    const source = join(root, name);
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "fixture.js"), bundle);
    writeFileSync(
      join(source, "extension.ts"),
      `import {createPagedCollectionFixture} from "./fixture.js";\nexport default createPagedCollectionFixture(${JSON.stringify(name)});\n`,
    );
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name,
        publisher: "example",
        version: "1.0.0",
        type: "module",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    extensions.push({ source, installName: name });
  }
  return extensions;
};

export const writeDiscoveredColumnsFixture = (root: string) => {
  const fixtures = writePagedCollectionFixtures(root);
  const first = fixtures[0]!;
  writeFileSync(
    join(first.source, "extension.ts"),
    'import {createDiscoveredColumnsFixture} from "./fixture.js";\nexport default createDiscoveredColumnsFixture();\n',
  );
  return [first];
};
