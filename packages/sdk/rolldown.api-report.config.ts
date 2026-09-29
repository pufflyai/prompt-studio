import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "rolldown";
import { dts } from "rolldown-plugin-dts";

// Bundles the public extension API into one file per entry for the checked-in API report.
// It bundles tsc's declaration output instead of generating types itself: generating types during
// the bundle prints some inferred unions in a different order on each run, and the report must be stable.
const entries = ["extensions", "extensions/react"];
const declarations = resolve(import.meta.dirname, ".api-report/declarations");

const declarationFile = (base: string) =>
  [`${base}.d.ts`, `${base}/index.d.ts`].find((candidate) => existsSync(candidate));

// The dts plugin would resolve these to the TypeScript sources, so point them at tsc's output first.
const resolveDeclarations: Plugin = {
  name: "resolve-declarations",
  resolveId: {
    order: "pre",
    handler(id) {
      if (id.startsWith("@/")) return declarationFile(`${declarations}/sdk/src/${id.slice("@/".length)}`);
      if (id === "pstdio-api-contracts") return declarationFile(`${declarations}/pstdio-api-contracts/src/index`);
      if (id.startsWith("pstdio-api-contracts/")) {
        return declarationFile(`${declarations}/pstdio-api-contracts/src/${id.slice("pstdio-api-contracts/".length)}`);
      }
      return null;
    },
  },
};

export default entries.map((entry) =>
  defineConfig({
    input: { [entry.replaceAll("/", "-")]: resolve(declarations, `sdk/src/${entry}/index.d.ts`) },
    external: (id) =>
      !id.startsWith(".") && !id.startsWith("/") && !id.startsWith("@/") && !id.startsWith("pstdio-api-contracts"),
    plugins: [resolveDeclarations, dts({ dtsInput: true, emitDtsOnly: true })],
    output: { dir: resolve(import.meta.dirname, ".api-report/bundle"), format: "es" },
  }),
);
