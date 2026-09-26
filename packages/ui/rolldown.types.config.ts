import path from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { entries } from "./build-entries.ts";

// Bundles one .d.ts per entry. `@/` is a source alias, so it must be inlined rather than left as an import.
const tsconfig = path.resolve(import.meta.dirname, "tsconfig.build.json");

export default defineConfig({
  input: entries,
  tsconfig,
  external: (id) => !id.startsWith(".") && !path.isAbsolute(id) && !id.startsWith("@/"),
  // Type files have no runtime, so imports kept only for side effects (such as CSS) must not survive.
  treeshake: { moduleSideEffects: "no-external" },
  plugins: [dts({ emitDtsOnly: true, tsconfig })],
  output: { dir: "dist", format: "es" },
});
