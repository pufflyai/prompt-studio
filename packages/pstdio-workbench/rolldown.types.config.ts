import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { entries, isExternal } from "./build-entries.ts";

// Bundles one self-contained .d.ts per entry, with the private packages inlined.
export default defineConfig({
  input: entries,
  tsconfig: "./tsconfig.build.json",
  external: isExternal,
  // Type files have no runtime, so imports kept only for side effects (such as CSS) must not survive.
  treeshake: { moduleSideEffects: "no-external" },
  plugins: [dts({ emitDtsOnly: true, tsconfig: "./tsconfig.build.json" })],
  output: { dir: "dist", format: "es" },
});
