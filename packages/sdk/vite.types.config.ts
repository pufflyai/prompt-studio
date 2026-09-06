import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const entries = ["api", "client", "extensions", "extensions/react", "hooks", "prompts", "resources"];

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: Object.fromEntries(
        entries.map((entry) => [entry.replaceAll("/", "-"), resolve(import.meta.dirname, `src/${entry}/index.ts`)]),
      ),
      formats: ["es"],
    },
    rollupOptions: { external: (id) => !id.startsWith(".") && !id.startsWith("/") },
  },
  plugins: [
    dts({
      tsconfigPath: "./tsconfig.build.json",
      declarationOnly: true,
      rollupTypes: true,
      bundledPackages: ["pstdio-api-contracts"],
      entryRoot: "..",
    }),
  ],
});
