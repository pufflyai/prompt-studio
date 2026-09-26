import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { entries, isExternal } from "./build-entries.ts";

// Bundles one self-contained .d.ts per entry, with the private packages inlined.
const tsconfig = path.resolve(import.meta.dirname, "tsconfig.build.json");

export default defineConfig({
  input: entries,
  tsconfig,
  external: isExternal,
  // Type files have no runtime, so imports kept only for side effects (such as CSS) must not survive.
  treeshake: { moduleSideEffects: "no-external" },
  plugins: [dts({ emitDtsOnly: true, tsconfig })],
  output: { dir: "dist", format: "es" },
});
