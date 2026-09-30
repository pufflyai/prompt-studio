import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import * as Jsx from "react/jsx-runtime";

const exportsBySpecifier = new Map<string, Promise<string[]>>();
const scanExports = async (specifier: string) => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const entrypoint =
    specifier === "motion-lab/kit" ? fileURLToPath(new URL("./kit/index.ts", import.meta.url)) : specifier;
  // Inspect browser exports without executing UI libraries in the server runtime.
  const result = await Bun.build({
    entrypoints: ["motion-shared-entry"],
    target: "browser",
    format: "esm",
    throw: false,
    plugins: [
      {
        name: "motion-shared-exports",
        setup(build) {
          build.onResolve({ filter: /^motion-shared-entry$/ }, () => ({
            path: join(sourceDir, "__motion_shared_entry__.ts"),
          }));
          build.onLoad({ filter: /__motion_shared_entry__\.ts$/ }, () => ({
            contents: `export * from ${JSON.stringify(entrypoint)};`,
            loader: "js",
          }));
        },
      },
    ],
  });
  if (!result.success) throw new Error(result.logs.map((log) => log.message).join("\n"));
  const code = await result.outputs.find((output) => output.kind === "entry-point")!.text();
  return new Bun.Transpiler({ loader: "js" }).scan(code).exports;
};
export const exportsFor = (specifier: string) => {
  if (specifier === "react") return Promise.resolve(Object.keys(React));
  if (specifier === "react/jsx-runtime") return Promise.resolve(Object.keys(Jsx));
  let pending = exportsBySpecifier.get(specifier);
  if (!pending) {
    pending = scanExports(specifier);
    exportsBySpecifier.set(specifier, pending);
  }
  return pending;
};
