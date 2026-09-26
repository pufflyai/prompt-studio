import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { entries } from "./build-entries";

// Bundles one .d.ts per entry. `@/` is a source alias, so it must be inlined rather than left as an import.
export default defineConfig({
  input: entries,
  tsconfig: "./tsconfig.build.json",
  external: (id) => !id.startsWith(".") && !path.isAbsolute(id) && !id.startsWith("@/"),
  // Type files have no runtime, so imports kept only for side effects (such as CSS) must not survive.
  treeshake: { moduleSideEffects: "no-external" },
  plugins: [dts({ emitDtsOnly: true, tsconfig: "./tsconfig.build.json" })],
  output: { dir: "dist", format: "es" },
});
