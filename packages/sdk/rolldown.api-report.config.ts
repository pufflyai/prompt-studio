import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

// Both revisions use this generator; source dependencies still resolve from their own source tree.
// The report must not change unless the API does. `stableTypeOrdering` in tsconfig.build.json makes TypeScript
// order union members and inferred properties the same way on every build, instead of in the order it happened
// to create their types.
const source = resolve(process.env.PSTDIO_API_REPORT_SOURCE ?? resolve(import.meta.dirname, "../.."));
const sdk = resolve(source, "packages/sdk");
const output = process.env.PSTDIO_API_REPORT_OUTPUT ?? resolve(sdk, ".api-report");
const entries = JSON.parse(
  process.env.PSTDIO_API_REPORT_ENTRIES ?? readFileSync(resolve(sdk, "api-report-entries.json"), "utf8"),
) as string[];
const tsconfig = resolve(sdk, "tsconfig.build.json");

export default entries.map((entry) =>
  defineConfig({
    input: { [entry.replaceAll("/", "-")]: resolve(sdk, `src/${entry}/index.ts`) },
    tsconfig,
    external: (id) =>
      !id.startsWith(".") &&
      !isAbsolute(id) &&
      !id.startsWith("@/") &&
      !id.startsWith("pstdio-api-contracts") &&
      !id.startsWith("pstdio-sync-contracts"),
    treeshake: { moduleSideEffects: "no-external" },
    plugins: [dts({ cwd: sdk, emitDtsOnly: true, tsconfig })],
    output: { dir: output, format: "es" },
  }),
);
