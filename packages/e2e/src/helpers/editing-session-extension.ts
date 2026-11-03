import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { installBuiltSdk } from "./installed-sdk";

export const writeEditingSessionExtension = (root: string) => {
  const source = join(root, "editing-fixture");
  mkdirSync(source, { recursive: true });
  cpSync(join(import.meta.dirname, "../fixtures/editing-session"), source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "editing-fixture",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  installBuiltSdk(source);
  return source;
};
