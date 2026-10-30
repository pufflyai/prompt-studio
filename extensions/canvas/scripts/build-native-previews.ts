import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { previews } from "../src/canvases/previews";
import { type NativeBuildOutput, publishNativeBuild } from "./native-build-output";

import { generatedRoot, generateStoryCatalog, repoRoot, suites } from "./story-catalog";

const nativeSources = Object.fromEntries(
  Object.entries(previews).map(([name, preview]) => [name, resolve(repoRoot, preview.source)]),
);
const nativeDeclaration = `const __UI_CANVAS_NATIVE__={${Object.entries(previews)
  .map(
    ([name, preview]) =>
      `${JSON.stringify(name)}:()=>import(${JSON.stringify(nativeSources[name])}).then(module=>module[${JSON.stringify(preview.exportName)}])`,
  )
  .join(",")}};`;
// Keep the shared rendering runtime together. Hundreds of tiny sandbox-local
// module URLs otherwise repeat their loader work in every frame.
const previewOutput = {
  minify: true,
  codeSplitting: {
    groups: [
      {
        name: "preview-core",
        test: /\/node_modules\/(?:react(?:-dom)?|scheduler|@chakra-ui|@emotion|@ark-ui|@zag-js)\//,
        entriesAware: true,
        entriesAwareMergeThreshold: 65_536,
      },
    ],
  },
};

const buildPreviews = async (stories: Awaited<ReturnType<typeof generateStoryCatalog>>["stories"]) => {
  const packageRoot = resolve(repoRoot, suites.ui);
  const uiRequire = createRequire(resolve(repoRoot, "packages/ui/package.json"));
  const { build } = await import(uiRequire.resolve("vite"));
  const scratch = resolve(packageRoot, "__test-tmp__/ui-canvas-native");
  await mkdir(scratch, { recursive: true });
  const files = [...new Set(stories.map((entry) => entry.source))];
  const declarations: string[] = [];
  const { createThemePreferenceFromVsCodeTheme } = await import(resolve(repoRoot, "packages/ui/dist/theme.js"));
  const { canvasVsCodeThemes } = await import(
    resolve(repoRoot, "packages/ui/src/theme/custom/vscode-theme.canvas-fixture.ts")
  );
  const frameThemes = await Promise.all(
    ["solarized-light", "solarized-dark", "dracula", "monokai"].map(async (id) => ({
      ...createThemePreferenceFromVsCodeTheme({
        id,
        mode: id.endsWith("light") ? "light" : "dark",
        theme: JSON.parse(
          await readFile(resolve(repoRoot, `extensions/pstdio-base-themes/themes/${id}-color-theme.json`), "utf8"),
        ),
      }),
      title: id
        .split("-")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" "),
    })),
  );
  await writeFile(resolve(generatedRoot, "frame-themes.json"), JSON.stringify([...frameThemes, ...canvasVsCodeThemes]));
  declarations.push(
    `const __UI_CANVAS_PROJECTS__={${Object.entries(suites)
      .map(
        ([suite, path]) =>
          `${JSON.stringify(suite)}:()=>import(${JSON.stringify(resolve(repoRoot, path, ".canvas/preview.tsx"))})`,
      )
      .join(",")}};`,
  );
  declarations.push(
    `const __UI_CANVAS_MODULES__={${files.map((file) => `${JSON.stringify(file)}:()=>import(${JSON.stringify(resolve(repoRoot, file))})`).join(",")}};`,
  );
  declarations.push(nativeDeclaration);
  const lookup = resolve(scratch, "catalog-lookup.ts");
  await writeFile(lookup, declarations.map((code) => `export ${code}`).join("\n"));
  declarations.length = 0;
  declarations.push(
    `import {__UI_CANVAS_MODULES__,__UI_CANVAS_PROJECTS__,__UI_CANVAS_NATIVE__} from ${JSON.stringify(lookup)};`,
    `import {createPreviewLoader} from ${JSON.stringify(resolve(repoRoot, "packages/canvas/src/native-preview-runtime.tsx"))};`,
    `import {mountPreviewRuntime} from ${JSON.stringify(resolve(import.meta.dir, "frame-runtime.tsx"))}; mountPreviewRuntime(createPreviewLoader(__UI_CANVAS_MODULES__,__UI_CANVAS_PROJECTS__),(component)=>__UI_CANVAS_NATIVE__[component]());`,
  );
  const entry = resolve(scratch, "entry.tsx");
  await writeFile(entry, declarations.join("\n"));
  const workspaceAliases: { find: RegExp; replacement: string }[] = [];
  const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [name, path] of [
    ["@pstdio/ui", "packages/ui"],
    ["@pstdio/sdk", "packages/sdk"],
  ]) {
    const manifest = JSON.parse(await readFile(resolve(repoRoot, path, "package.json"), "utf8"));
    for (const [key, value] of Object.entries(manifest.exports)) {
      const entry = typeof value === "string" ? value : (value as { import?: string }).import;
      if (entry) {
        const specifier = key === "." ? name : `${name}${key.slice(1)}`;
        workspaceAliases.push({
          find: new RegExp(`^${specifier.split("*").map(escapePattern).join("(.*)")}$`),
          replacement: resolve(repoRoot, path, entry.replace("*", "$1")),
        });
      }
    }
  }
  workspaceAliases.sort((a, b) => b.find.source.length - a.find.source.length);
  const { entries } = await import(resolve(repoRoot, "packages/pstdio-workbench/build-entries.ts"));
  for (const [name, entry] of Object.entries(entries)) {
    const specifier = name === "index" ? "@pstdio/workbench" : `@pstdio/workbench/${name}`;
    workspaceAliases.unshift({ find: new RegExp(`^${escapePattern(specifier)}$`), replacement: String(entry) });
  }
  const result = await build({
    configFile: false,
    root: packageRoot,
    publicDir: false,
    logLevel: "error",
    // UI Canvas's own workspace stories must not recursively embed the entire catalog.
    plugins: [
      {
        name: "ui-canvas-mdx",
        enforce: "pre",
        async transform(source: string, id: string) {
          if (id.endsWith("/@chakra-ui/react/dist/esm/preset.js")) {
            // Reading defaultConfig must not initialize Chakra's unused default system
            // in every sandbox. Keep the factory call when an example uses defaultSystem.
            return {
              code: source.replace("= createSystem(defaultConfig)", "= /* @__PURE__ */ createSystem(defaultConfig)"),
              map: null,
            };
          }
          if (id === resolve(repoRoot, "packages/ui/dist-monaco/monaco.js")) {
            return {
              code: `${source}\nimport {installCanvasMonacoWorkers} from ${JSON.stringify(resolve(import.meta.dir, "frame-monaco-workers.ts"))}; installCanvasMonacoWorkers(self.MonacoEnvironment);`,
              map: null,
            };
          }
          if (id.endsWith("/foundations/component-gallery.canvas.tsx")) {
            const hook = 'import { useTokenEditorValues } from "@/components/internal/token-editor-state";';
            const call = "useTokenEditorValues({ themePreference, themePreferences })";
            if (!source.includes(hook) || !source.includes(call))
              throw new Error("Gallery fixture source changed; reconcile its local token state");
            return {
              code: source
                .replace(
                  hook,
                  `import { getDefaultTokenEditorValues } from "@/components/internal/token-editor-state"; import {useCanvasTokenEditorValues} from ${JSON.stringify(resolve(import.meta.dir, "frame-token-editor-fixture.ts"))};`,
                )
                .replace(
                  call,
                  "useCanvasTokenEditorValues({ themePreference, themePreferences }, getDefaultTokenEditorValues)",
                ),
              map: null,
            };
          }
          if (id.endsWith("/modules/workspaces/collections/workspace-list.canvas.tsx")) {
            const start = source.indexOf("const useDiffSummaryResponses =");
            const end = source.indexOf("interface WorkspaceListStoryProps", start);
            if (start < 0 || end < 0)
              throw new Error("Workspace fixture source changed; reconcile its local API fixture");
            return {
              code: `${source.slice(0, start)}const useDiffSummaryResponses = () => {};\n${source.slice(end)}`,
              map: null,
            };
          }
        },
      },
      {
        name: "ui-canvas-workspace-fixture",
        enforce: "pre",
        resolveId(
          this: { resolve: (path: string, importer: string, options: { skipSelf: boolean }) => Promise<unknown> },
          id: string,
          importer?: string,
        ) {
          if (!id.startsWith("@/") || !importer) return;
          const owner = Object.entries(suites).find(([, path]) => importer.startsWith(`${resolve(repoRoot, path)}/`));
          const path = owner?.[0] === "workbench" ? suites.ui : (owner?.[1] ?? suites.ui);
          return this.resolve(resolve(repoRoot, path, "src", id.slice(2)), importer, { skipSelf: true });
        },
        load(id: string) {
          if (id.endsWith("/catalog/generated/frame-bundle.ts")) return 'export default "";';
          if (id === resolve(repoRoot, suites.website, "src/components/root-provider.tsx"))
            return 'import {ChakraProvider} from "@chakra-ui/react"; import {landingTheme} from "../theme/theme"; export const RootProvider = ({children}) => <ChakraProvider value={landingTheme}>{children}</ChakraProvider>;';
          if (id === resolve(repoRoot, suites.website, "src/services/analytics.ts"))
            return "export const loadAnalytics = async () => ({capture: () => {}});";
          if (id === resolve(repoRoot, suites.ui, "src/utils/theme-preference.tsx"))
            return 'export {getInitialThemePreference, ThemePreferenceProvider, useThemePreference} from "@pstdio/ui";';
          if (id.endsWith("/catalog/generated/native-preview.ts"))
            return 'export const loadPreview = async () => {throw new Error("Recursive catalog preview")};';
          if (id === resolve(repoRoot, suites.dashboard, "src/shared/app/dashboard-storage.ts"))
            return `export * from ${JSON.stringify(resolve(import.meta.dir, "frame-storage-fixture.ts"))};`;
          if (id === resolve(repoRoot, suites.dashboard, "src/lib/api.ts"))
            return `export * from ${JSON.stringify(resolve(import.meta.dir, "native-api-fixture.ts"))};`;
          if (id === resolve(repoRoot, suites.ui, ".canvas/preview.tsx")) return "export default {};";
        },
      },
    ],
    define: { "process.env.NODE_ENV": JSON.stringify("production"), global: "globalThis" },
    resolve: {
      dedupe: ["react", "react-dom", "@chakra-ui/react", "@emotion/react", "@pstdio/ui", "@pstdio/sdk"],
      alias: [...workspaceAliases, { find: "$fonts", replacement: resolve(packageRoot, "public/font") }],
    },
    esbuild: { jsx: "automatic" },
    build: {
      write: false,
      minify: true,
      sourcemap: false,
      cssCodeSplit: true,
      assetsInlineLimit: () => true,
      lib: { entry, name: "UICanvasPreview", formats: ["es"] },
      rollupOptions: {
        output: previewOutput,
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((result) => result.output) as NativeBuildOutput[];
  await publishNativeBuild(
    outputs,
    { stories: stories.length },
    {
      repoRoot,
      sources: Object.fromEntries(stories.map(({ source, suite }) => [source, suite])),
      projects: Object.fromEntries(
        Object.entries(suites).map(([name, path]) => [name, resolve(repoRoot, path, ".canvas/preview.tsx")]),
      ),
      nativeSources,
      catalogSource: lookup,
    },
  );
};
const catalog = await generateStoryCatalog();
await buildPreviews(catalog.stories);
