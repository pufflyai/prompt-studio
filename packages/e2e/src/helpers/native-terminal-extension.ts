import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { installBuiltSdk } from "./installed-sdk";

/** A separately installed consumer of the candidate public SDK; no host aliases or React injection. */
export const writeNativeTerminalExtension = (project: string) => {
  const source = join(project, "native-terminal");
  mkdirSync(source, { recursive: true });
  cpSync(join(import.meta.dirname, "../fixtures/native-terminal/extension.ts"), join(source, "extension.ts"));
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "native-terminal",
      publisher: "example",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
        types: [],
      },
      include: ["extension.ts"],
    }),
  );
  installBuiltSdk(source);
  execFileSync("bun", ["check"], { cwd: source, stdio: "pipe" });
  return source;
};
