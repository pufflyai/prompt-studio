import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

// Bundles the public extension API into one self-contained file per entry for the checked-in API report.
// The report must not change unless the API does. `stableTypeOrdering` in tsconfig.build.json makes TypeScript
// order union members and inferred properties the same way on every build, instead of in the order it happened
// to create their types.
const entries = JSON.parse(readFileSync(new URL("./api-report-entries.json", import.meta.url), "utf8")) as string[];
const tsconfig = resolve(import.meta.dirname, "tsconfig.build.json");

export default entries.map((entry) =>
  defineConfig({
    input: { [entry.replaceAll("/", "-")]: resolve(import.meta.dirname, `src/${entry}/index.ts`) },
    tsconfig,
    external: (id) =>
      !id.startsWith(".") &&
      !isAbsolute(id) &&
      !id.startsWith("@/") &&
      !id.startsWith("pstdio-api-contracts") &&
      !id.startsWith("pstdio-sync-contracts"),
    treeshake: { moduleSideEffects: "no-external" },
    plugins: [dts({ emitDtsOnly: true, tsconfig })],
    output: { dir: resolve(import.meta.dirname, ".api-report"), format: "es" },
  }),
);
