import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const externalPackages = new Set([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@pstdio/sdk/api",
  "@xterm/addon-fit",
  "@xterm/xterm",
]);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    lib: {
      entry: {
        index: path.resolve(import.meta.dirname, "src/index.ts"),
      },
      formats: ["es"],
      cssFileName: "style",
    },
    rollupOptions: {
      external: (id) => externalPackages.has(id),
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    dts({
      tsconfigPath: "./tsconfig.json",
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.stories.tsx"],
      afterDiagnostic: () => {},
    }),
  ],
});
