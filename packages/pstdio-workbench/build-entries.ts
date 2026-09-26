import path from "node:path";

// Inline only the private workspace packages that cannot be published; everything
// else (react, @pstdio/sdk, @pstdio/ui, chakra, zustand, …) stays external so the
// consumer provides a single copy.
const INLINE_PACKAGES = new Set(["pstdio-extensions", "pstdio-api-contracts"]);

const packageNameOf = (id: string) => (id.startsWith("@") ? id.split("/").slice(0, 2).join("/") : id.split("/")[0]);

// `@/` is the source alias. tsc can write it into inferred types, so it must never be treated as a package.
export const isExternal = (id: string) => {
  if (id.startsWith(".") || id.startsWith("@/") || path.isAbsolute(id)) return false;
  return !INLINE_PACKAGES.has(packageNameOf(id));
};

export const entries = {
  index: path.resolve(import.meta.dirname, "src/index.ts"),
  react: path.resolve(import.meta.dirname, "src/react/index.ts"),
  storage: path.resolve(import.meta.dirname, "src/storage/index.ts"),
  extensions: path.resolve(import.meta.dirname, "src/extensions/index.ts"),
  "webview-runtime": path.resolve(import.meta.dirname, "src/webview-runtime/index.ts"),
};
