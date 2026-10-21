import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeEditingSessionExtension = (root: string) => {
  const source = join(root, "editing-fixture");
  mkdirSync(source, { recursive: true });
  cpSync(join(import.meta.dirname, "../fixtures/editing-session"), source, { recursive: true });
  const sdk = join(source, "sdk");
  mkdirSync(sdk);
  cpSync(join(import.meta.dirname, "../../../sdk/dist"), join(sdk, "dist"), { recursive: true });
  writeFileSync(
    join(sdk, "package.json"),
    JSON.stringify({
      name: "@pstdio/sdk",
      version: "0.0.0",
      type: "module",
      exports: { "./extensions": "./dist/extensions/index.js" },
    }),
  );
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "editing-fixture",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      dependencies: { "@pstdio/sdk": "file:./sdk" },
    }),
  );
  return source;
};
