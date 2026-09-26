import { isAbsolute, resolve } from "node:path";
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const entries = ["api", "client", "extensions", "extensions/react", "hooks", "prompts", "resources", "testing", "data"];

// Bundles one self-contained .d.ts per entry. `pstdio-api-contracts` is private and `@/` is a source alias
// that tsc can write into inferred types, so both must be inlined rather than left as imports.
export default defineConfig({
  input: Object.fromEntries(
    entries.map((entry) => [entry.replaceAll("/", "-"), resolve(import.meta.dirname, `src/${entry}/index.ts`)]),
  ),
  tsconfig: "./tsconfig.build.json",
  external: (id) =>
    !id.startsWith(".") && !isAbsolute(id) && !id.startsWith("@/") && !id.startsWith("pstdio-api-contracts"),
  // Type files have no runtime, so imports kept only for side effects (such as CSS) must not survive.
  treeshake: { moduleSideEffects: "no-external" },
  plugins: [dts({ emitDtsOnly: true, tsconfig: "./tsconfig.build.json" })],
  output: { dir: "dist", format: "es" },
});
