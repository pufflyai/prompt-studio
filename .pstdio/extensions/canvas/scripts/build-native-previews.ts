import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { type NativeBuildOutput, publishNativeBuild } from "./native-build-output";

import { generateStoryCatalog, repoRoot, suites } from "./story-catalog";

const buildPreviews = async (
  stories: Awaited<ReturnType<typeof generateStoryCatalog>>["stories"],
  documents: Awaited<ReturnType<typeof generateStoryCatalog>>["documents"],
) => {
  const packageRoot = resolve(repoRoot, suites.ui);
  const uiRequire = createRequire(resolve(repoRoot, "packages/ui/package.json"));
  const { build } = await import(uiRequire.resolve("vite"));
  const { esmExternalRequirePlugin } = await import(uiRequire.resolve("rolldown/plugins"));
  const scriptsRequire = createRequire(resolve(repoRoot, ".pstdio/extensions/canvas/package.json"));
  const { compile } = await import(scriptsRequire.resolve("@mdx-js/mdx"));
  const scratch = resolve(packageRoot, "__test-tmp__/ui-canvas-native");
  await mkdir(scratch, { recursive: true });
  const files = [...new Set([...stories, ...documents].map((entry) => entry.source))];
  const declarations: string[] = [];
  declarations.push(
    `const __UI_CANVAS_PROJECTS__={${Object.entries(suites)
      .map(
        ([suite, path]) =>
          `${JSON.stringify(suite)}:()=>import(${JSON.stringify(resolve(repoRoot, path, ".storybook/preview.tsx"))})`,
      )
      .join(",")}};`,
  );
  declarations.push(
    `const __UI_CANVAS_MODULES__={${files.map((file) => `${JSON.stringify(file)}:()=>import(${JSON.stringify(resolve(repoRoot, file))})`).join(",")}};`,
  );
  declarations.push(
    (await readFile(resolve(import.meta.dir, "native-preview-runtime.tsx"), "utf8")).replace(
      '"./story-canvas-theme"',
      JSON.stringify(resolve(import.meta.dir, "story-canvas-theme.tsx")),
    ),
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
      esmExternalRequirePlugin({
        external: [
          /^react(?:-dom)?(?:\/|$)/,
          /^@chakra-ui\/react(?:\/|$)/,
          /^@emotion\/react(?:\/|$)/,
          /^@pstdio\/(?:ui|sdk)(?:\/|$)/,
        ],
      }),
      {
        name: "ui-canvas-mdx",
        enforce: "pre",
        async transform(source: string, id: string) {
          if (id.endsWith("/modules/workspaces/collections/workspace-list.stories.tsx")) {
            const start = source.indexOf("const useDiffSummaryResponses =");
            const end = source.indexOf("interface WorkspaceListStoryProps", start);
            if (start < 0 || end < 0)
              throw new Error("Workspace fixture source changed; reconcile its local API fixture");
            return {
              code: `${source.slice(0, start)}const useDiffSummaryResponses = () => {};\n${source.slice(end)}`,
              map: null,
            };
          }
          if (id.endsWith(".mdx")) {
            const code = String(await compile(source)).replace(
              "export default function MDXContent(",
              "function MDXContent(",
            );
            return {
              code: `${code}\nimport {createElement as __createDocument} from "react";\nimport {Document as __Document} from ${JSON.stringify(resolve(import.meta.dir, "native-document-blocks.tsx"))};\nexport default function UICanvasDocument(){return __createDocument(__Document,{component:MDXContent,annotations:${source.match(/<Meta\s[^>]*of=\{(\w+)\}/)?.[1] ?? "{}"}.default});}`,
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
          if (id === resolve(repoRoot, suites.website, "src/components/root-provider.tsx"))
            return 'import {ChakraProvider} from "@chakra-ui/react"; import {landingTheme} from "../theme/theme"; export const RootProvider = ({children}) => <ChakraProvider value={landingTheme}>{children}</ChakraProvider>;';
          if (id === resolve(repoRoot, suites.website, "src/services/analytics.ts"))
            return "export const loadAnalytics = async () => ({capture: () => {}});";
          if (id === resolve(repoRoot, suites.ui, "src/utils/theme-preference.tsx"))
            return 'export {getInitialThemePreference, ThemePreferenceProvider, useThemePreference} from "@pstdio/ui";';
          if (id.endsWith("/catalog/generated/native-preview.ts"))
            return 'export const loadPreview = async () => {throw new Error("Recursive catalog preview")};';
          if (id === resolve(repoRoot, suites.dashboard, "src/lib/api.ts"))
            return `export * from ${JSON.stringify(resolve(import.meta.dir, "native-api-fixture.ts"))};`;
          if (id === resolve(repoRoot, suites.ui, ".storybook/preview.tsx"))
            return 'export default {parameters:{layout:"padded"}};';
          if (id.endsWith("/catalog/generated/design-bundles.ts")) return "export const designBundles = {};";
        },
      },
    ],
    define: { "process.env.NODE_ENV": JSON.stringify("production"), global: "globalThis" },
    resolve: {
      dedupe: ["react", "react-dom", "@chakra-ui/react", "@emotion/react", "@pstdio/ui", "@pstdio/sdk"],
      alias: [
        { find: "@storybook/addon-docs/blocks", replacement: resolve(import.meta.dir, "native-document-blocks.tsx") },
        { find: "@storybook/react", replacement: uiRequire.resolve("@storybook/react") },
        ...workspaceAliases,
        { find: "$fonts", replacement: resolve(packageRoot, "public/font") },
      ],
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
        output: { inlineDynamicImports: false },
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((result) => result.output) as NativeBuildOutput[];
  await publishNativeBuild(outputs, { stories: stories.length, documents: documents.length });
};
const catalog = await generateStoryCatalog();
await buildPreviews(catalog.stories, catalog.documents);
