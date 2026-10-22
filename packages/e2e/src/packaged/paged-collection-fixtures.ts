import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writePagedCollectionFixtures = async (root: string) => {
  const bundle = await Bun.build({
    entrypoints: [join(import.meta.dir, "fixtures/paged-collection-extension.ts")],
    target: "bun",
  });
  if (!bundle.success) throw new AggregateError(bundle.logs, "Could not build paged public fixtures");
  const extensions = [];
  for (let owner = 0; owner < 10; owner++) {
    const name = `paged-owner-${owner}`;
    const source = join(root, name);
    mkdirSync(source, { recursive: true });
    await Bun.write(join(source, "fixture.js"), bundle.outputs[0]!);
    await Bun.write(
      join(source, "extension.ts"),
      `import {createPagedCollectionFixture} from "./fixture.js";\nexport default createPagedCollectionFixture(${JSON.stringify(name)});\n`,
    );
    await Bun.write(
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
