import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

/** Builds the grouped-storage "shared notes" fixture extension for PSTDIO_DEFAULT_EXTENSIONS. */
export const writeSharedNotesExtension = async (root: string) => {
  const source = join(root, "source");
  await mkdir(source);
  const build = await Bun.build({
    entrypoints: [join(import.meta.dir, "fixtures/grouped-storage-extension.ts")],
    target: "bun",
  });
  if (!build.success) throw new AggregateError(build.logs, "Could not build storage fixture");
  await Bun.write(join(source, "extension.js"), build.outputs[0]!);
  await Bun.write(
    join(source, "package.json"),
    JSON.stringify({
      name: "shared-notes",
      publisher: "example",
      version: "1.0.0",
      type: "module",
      main: "extension.js",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  return source;
};
