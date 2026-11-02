import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { installBuiltSdk } from "./installed-sdk";

/** Both publishers install the packed SDK with ordinary package-local dependencies. */
export const writePublicTextExtensions = (root: string) => {
  const write = (
    name: string,
    publisher: string,
    dependencies: Record<string, string> = {},
    devDependencies: Record<string, string> = { "@types/bun": "1.4.4" },
  ) => {
    const source = join(root, name);
    mkdirSync(source, { recursive: true });
    cpSync(join(import.meta.dirname, "../fixtures", name), source, { recursive: true });
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name,
        publisher,
        version: "1.0.0",
        type: "module",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        dependencies,
        devDependencies,
      }),
    );
    installBuiltSdk(source);
    return source;
  };
  return {
    source: write("public-text-source", "paper"),
    editor: write(
      "public-text-editor",
      "ink",
      {
        "@pstdio/ui": "0.45.0",
        "@chakra-ui/react": "3.32.0",
        "@emotion/react": "11.14.0",
        react: "19.2.4",
        "react-dom": "19.2.4",
        yjs: "^13.6.29",
      },
      { "@types/bun": "1.4.4", "@types/react": "19.2.14", "@types/react-dom": "19.2.3" },
    ),
  };
};
