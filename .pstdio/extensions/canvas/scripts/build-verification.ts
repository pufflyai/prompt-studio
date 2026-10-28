import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { repoRoot } from "./story-catalog";
export const buildVerification = async () => {
  const uiRequire = createRequire(resolve(repoRoot, "packages/ui/package.json"));

  const { build } = await import(uiRequire.resolve("vite"));

  const root = resolve(repoRoot, "__test-tmp__/native-canvas-verification");
  await mkdir(root, { recursive: true });
  await writeFile(
    resolve(root, "canvas.html"),
    `<html><head><title>Native Canvas verification</title><style>html,body,#root{margin:0;width:100%;height:100%}</style></head><body><div id="root"></div><script type="module" src="${resolve(import.meta.dir, "native-verification-entry.tsx")}"></script></body></html>`,
  );
  await writeFile(
    resolve(root, "index.html"),
    '<html><head><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style></head><body><iframe data-verification-host title="UI Canvas" sandbox="allow-scripts allow-forms" ></iframe><script>document.querySelector("iframe").src="/canvas.html"+location.search</script></body></html>',
  );
  await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: "error",
    resolve: { dedupe: ["react", "react-dom", "@chakra-ui/react", "@emotion/react", "@pstdio/ui", "@pstdio/sdk"] },
    esbuild: { jsx: "automatic" },
    build: {
      outDir: resolve(root, "dist"),
      assetsInlineLimit: () => true,
      minify: true,
      rollupOptions: { input: { index: resolve(root, "index.html"), canvas: resolve(root, "canvas.html") } },
    },
  });

  return resolve(root, "dist");
};
if (import.meta.main) console.log(await buildVerification());
