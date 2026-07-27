import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Inline only the private workspace packages that cannot be published; everything
// else (react, @pstdio/sdk, @pstdio/ui, chakra, zustand, …) stays external so the
// consumer provides a single copy.
const INLINE_PACKAGES = new Set(["pstdio-extensions", "pstdio-api-contracts"]);

const packageNameOf = (id: string) => (id.startsWith("@") ? id.split("/").slice(0, 2).join("/") : id.split("/")[0]);

const isExternal = (id: string) => {
  if (id.startsWith(".") || path.isAbsolute(id)) return false;
  return !INLINE_PACKAGES.has(packageNameOf(id));
};

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
        react: path.resolve(import.meta.dirname, "src/react/index.ts"),
        storage: path.resolve(import.meta.dirname, "src/storage/index.ts"),
        extensions: path.resolve(import.meta.dirname, "src/extensions/index.ts"),
        testing: path.resolve(import.meta.dirname, "src/testing/index.ts"),
        "webview-runtime": path.resolve(import.meta.dirname, "src/webview-runtime/index.ts"),
      },
      formats: ["es"],
      cssFileName: "style",
    },
    rollupOptions: {
      external: isExternal,
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
      rollupTypes: true,
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.stories.ts",
        "src/**/*.stories.tsx",
        "src/**/*.storybook.ts",
        "src/examples/**",
      ],
      afterDiagnostic: () => {},
    }),
  ],
});
