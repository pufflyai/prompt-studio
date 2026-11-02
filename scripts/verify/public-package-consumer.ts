import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freshInstallArgs } from "./fresh-install";
import { verifyMonacoPackageAssets } from "./monaco-package-assets";
import { verifyProviderPackageConsumer } from "./provider-package-consumer";
import { writeStoragePackageConsumer } from "./storage-package-consumer";
import { writeWorkbenchPackageConsumer } from "./workbench-package-consumer";

const run = (cwd: string, args: string[]) => {
  const result = Bun.spawnSync(["bun", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.toString();
};

const readManifest = (path: string) => JSON.parse(readFileSync(join(path, "package.json"), "utf8"));

const nativeEntries: Record<string, readonly string[]> = {
  "@pstdio/sdk": ["./resources", "./api", "./client", "./extensions", "./prompts", "./hooks", "./testing", "./data"],
  "@pstdio/workbench": [".", "./storage", "./webview-runtime"],
};

// CSS files and subpath patterns (such as `./monaco/*`) are not importable type entries.
const isTypeEntry = (entry: string) => !entry.endsWith(".css") && !entry.includes("*");

const consumerDependencies = (packages: { path: string; archive: string }[], react: boolean) => {
  const dependencies: Record<string, string> = { typescript: "6.0.2" };
  const overrides: Record<string, string> = {};
  const imports: string[] = [];
  for (const pkg of packages) {
    const manifest = readManifest(pkg.path);
    dependencies[manifest.name] = `file:${pkg.archive}`;
    overrides[manifest.name] = `file:${pkg.archive}`;
    if (react) {
      const development = readManifest(resolve(pkg.path, ".."));
      for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
        dependencies[name] = development.devDependencies?.[name] ?? range;
      }
    }
    for (const entry of Object.keys(manifest.exports)) {
      if (!isTypeEntry(entry) || (!react && !nativeEntries[manifest.name]?.includes(entry))) continue;
      imports.push(`${manifest.name}${entry === "." ? "" : entry.slice(1)}`);
    }
  }
  if (react)
    Object.assign(dependencies, {
      vite: "^8.3.1",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@types/node": "^25.0.0",
    });
  return { dependencies, overrides, imports };
};

const checkConsumer = (
  root: string,
  packages: { path: string; archive: string }[],
  react: boolean,
  repoRoot: string,
) => {
  const directory = join(root, react ? "react-consumer" : "native-consumer");
  mkdirSync(directory);
  const { dependencies, overrides, imports } = consumerDependencies(packages, react);
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      name: react ? "react-consumer" : "native-consumer",
      private: true,
      type: "module",
      dependencies,
      overrides,
    }),
  );
  const install = freshInstallArgs(repoRoot, directory);
  run(directory, react ? install : [...install, "--omit", "peer"]);
  run(directory, [
    "--eval",
    `
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
const path = new URL("../../package.json", import.meta.resolve("@pstdio/sdk/extensions"));
const manifest = await Bun.file(path).json();
if (manifest.pstdio?.extensionApiVersion !== EXTENSION_API_VERSION)
  throw new Error("Packed SDK API metadata differs from its runtime API version");
`,
  ]);
  writeFileSync(
    join(directory, "consumer.ts"),
    imports
      .map((entry, index) => `import * as entry${index} from ${JSON.stringify(entry)}; export { entry${index} };`)
      .join("\n") +
      `
import { type CollectionBadgeItem, defineNavigationTree, defineView, workbenchModes } from "@pstdio/sdk/extensions";
const attentionBadge: CollectionBadgeItem = {
  id: "attention", label: "1",
  action: { kind: "panel", panel: { kind: "page-slot", page: { kind: "page", id: "tickets" }, id: "attention" }, resource: { type: "ticket", id: "one" } },
};
void attentionBadge;
const projectItems = defineView({ id: "project-items", title: "Items", body: { kind: "tree", body: async () => [] } });
const projectNavigation = defineNavigationTree({ id: "project-items", owner: workbenchModes.project, view: projectItems.ref, resourceScope: "project" });
if (projectNavigation.resourceScope !== "project") throw new Error("Navigation lost its resource scope");
import type { ExtensionDiagnosticsResponse } from "@pstdio/sdk/api";
type PageMain = ExtensionDiagnosticsResponse["roots"][number]["check"]["pages"][number]["main"];
type Placeholder = Extract<NonNullable<Extract<PageMain, { kind: "panels" }>["empty"]>, { view: unknown }>;
type Menus = NonNullable<NonNullable<Placeholder["breadcrumb"]>["menu"]>;
type MenuAction = NonNullable<Menus[number]["rows"][number]["action"]>;
type CompoundPanel = Extract<Extract<MenuAction, { kind: "compound" }>["targets"][number], { kind: "panel" }>;
const consumePanelTarget = (target: CompoundPanel) => {
  if (target.panel.kind === "page-slot") {
    const page: { extensionId: string; kind: "page"; id: string } = target.panel.page;
    return page.id;
  }
  return target.panel.id;
};
void consumePanelTarget;
` +
      (imports.includes("@pstdio/workbench")
        ? `
import { createWorkbench } from "@pstdio/workbench";
const headerWorkbench = createWorkbench();
headerWorkbench.modes.registerMode({ id: "legacy", activate() {}, regionSettings: { main: { alwaysShowTabs: false } } });
headerWorkbench.modes.registerMode({ id: "native", activate() {}, regionSettings: { main: { showHeader: false } } });
headerWorkbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
for (const presentation of [undefined, "page", "tabs"] as const) {
  const id = presentation ?? "legacy";
  const page = { kind: "page", extensionId: "consumer", id } as const;
  headerWorkbench.pages.registerPage({ id, ref: page, title: id, path: id, modeId: presentation ? "native" : "legacy",
    main: { kind: "view", presentation, view: { kind: "view", id: "content" }, cardinality: "one" }, slots: [] });
  headerWorkbench.pageLocations.setProject("consumer");
  headerWorkbench.pageLocations.navigate({ kind: "page", page });
  if (headerWorkbench.shell.getPanelPolicy("main").showHeader !== (presentation === "tabs")) {
    throw new Error("Page headers lost the legacy or explicit presentation policy");
  }
}
headerWorkbench.dispose();
`
        : "") +
      (react && imports.includes("@pstdio/ui")
        ? `
import { createElement } from "react";
import { BubblePanel, ListRow, TreeList, defaultThemePreferences, createThemePreferenceFromVsCodeTheme } from "@pstdio/ui";
const imported = createThemePreferenceFromVsCodeTheme({
  id: "packed", mode: "dark", theme: { colors: { "editor.background": "#222222" }, pstdio: { colors: { "border.accent": "#ABCDEF" } } },
});
if (!imported.tokens?.["colors.bg.subtle"] || imported.tokens["colors.bg.subtle"] === imported.tokens["colors.bg"])
  throw new Error("Packed UI lost imported theme surface fallbacks");
if (imported.tokens["colors.border.accent"] !== "#ABCDEF") throw new Error("Packed UI lost application overrides");
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (first: string, second: string) => {
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};
const contrastThemes = defaultThemePreferences.filter((theme) => theme.id.startsWith("prompt-contrast-"));
if (contrastThemes.length !== 2) throw new Error("Packed UI lost its contrast themes");
for (const theme of contrastThemes) {
  const colors = "tokens" in theme ? theme.tokens : undefined;
  if (!colors) throw new Error("Packed contrast theme has no colors");
  for (const role of ["colors.fg", "colors.fg.muted", "colors.fg.subtle"]) {
    if (contrast(colors[role], colors["colors.bg"]) < 4.5) throw new Error("Packed contrast theme has unreadable text");
  }
  if (contrast(colors["colors.border"], colors["colors.bg"]) < 3) throw new Error("Packed contrast theme lost control boundaries");
}
import { Canvas, zoomCanvas, type CanvasCamera } from "@pstdio/ui/canvas";
import { DependencyTimeline } from "@pstdio/ui/dependency-timeline";
import { KeyframeTimeline, sampleTrack, type KeyframeTrack } from "@pstdio/ui/keyframe-timeline";
const animationTrack: KeyframeTrack = { id: "opacity", label: "Opacity", keyframes: [{ id: "start", time: 0, value: 0 }, { id: "end", time: 2, value: 1 }] };
if (sampleTrack(animationTrack, 1) !== 0.5) throw new Error("Animation interpolation changed");
const keyframeTimeline = createElement(KeyframeTimeline, { tracks: [animationTrack], duration: 2, currentTime: 1, onTimeChange: () => {}, onRestart: () => {} });
let camera: CanvasCamera = { x: 0, y: 0, zoom: 1 };
const canvas = createElement(Canvas, {
  "aria-label": "Design canvas", variant: "pan", zoom: camera.zoom, minZoom: 0.1, maxZoom: 4,
  onPan: (delta) => { camera = { ...camera, x: camera.x + delta.x, y: camera.y + delta.y }; },
  onZoom: (change) => { camera = zoomCanvas(camera, change, { minZoom: 0.1, maxZoom: 4 }); },
});
canvas.props.onZoom({ factor: 2, anchor: { x: 100, y: 50 } });
if (camera.zoom !== 2 || camera.x !== -100 || camera.y !== -50) throw new Error("Canvas zoom lost its anchor");
const timeline = createElement(DependencyTimeline, { today: "2026-10-10", tracks: [{ id: "work", label: "Work" }], sections: [{ id: "release", header: "Release", items: [{ id: "item", trackId: "work", dependencies: [], content: createElement("button", null, "Item") }] }] });
const outliner = createElement(TreeList, {
  sections: [{ id: "layers", nodes: [{ id: "image", label: "Image", startContent: createElement("span"),
    actionsVisibility: "always", actions: [{ id: "visibility", label: "Visibility", pressed: true, disabled: false }] }] }],
  activeNodeId: ["image"], onSelectionChange: (ids: string[]) => void ids, moveSelection: true,
  onMoveNode: (source: string) => void source,
});
const groupRow = createElement(ListRow, { label: "Group", isContainer: true, showExpandToggle: true,
  expandOnClick: false, onToggleExpand: () => {}, startContent: createElement("span") });
void [canvas, timeline, keyframeTimeline, outliner, groupRow];
import { CollectionViewBar, EMPTY_VIEW_FILTER, filterRowsByView, withTitleField } from "@pstdio/ui/collection-view";
const panelOverlay = createElement(BubblePanel, { isOpen: true, overlay: createElement("div", { "data-drop-feedback": true }) });
void panelOverlay;
const fields = withTitleField([]);
const rows = [{ id: "one", title: "A ticket", attributes: {} }];
const filtered = filterRowsByView(rows, EMPTY_VIEW_FILTER, fields);
const viewBar = createElement(CollectionViewBar, {
  storageKey: "public-consumer", initialState: { settings: {} },
  views: [{ id: "all", title: "All", settings: {}, filter: EMPTY_VIEW_FILTER, sorts: [], builtIn: true }],
  fields, optionsFor: () => [], search: "", onSearchChange: () => {}, displayControl: null,
});
void [filtered, viewBar];
`
        : "") +
      (react && imports.includes("@pstdio/workbench/react")
        ? `
import type { ReactAttributeDescriptor, ReactBoardColumnConfig } from "@pstdio/workbench/react";
const invalidAttribute: ReactAttributeDescriptor = {
  id: "title", label: "Title", type: { kind: "string" },
  // @ts-expect-error React cell callbacks must return React nodes.
  render: () => ({ invalid: true }),
};
const invalidColumn: ReactBoardColumnConfig = {
  // @ts-expect-error React column icons must be components.
  actions: [{ id: "create", label: "Create", icon: "plus" }],
};
void [invalidAttribute, invalidColumn];
`
        : ""),
  );
  writeStoragePackageConsumer(directory);
  writeWorkbenchPackageConsumer(directory, react);
  if (react && dependencies["@pstdio/ui"]) {
    cpSync(join(directory, "node_modules/@pstdio/ui/examples/performance"), join(directory, "performance-example"), {
      recursive: true,
    });
  }
  writeFileSync(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
        lib: ["ES2022", "ES2023.Intl", "ESNext.Disposable", "DOM", "DOM.Iterable"],
        jsx: "react-jsx",
        types: react ? ["node", "vite/client"] : [],
      },
      include: [
        "consumer.ts",
        "storage-consumer.ts",
        "workbench-consumer.ts",
        "performance-example/*.ts",
        "performance-example/*.tsx",
      ],
    }),
  );
  run(directory, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]);
  run(directory, ["check", "-p", "tsconfig.json"]);
  run(directory, ["workbench-consumer.ts"]);
  if (react) {
    writeFileSync(
      join(directory, "vite.config.ts"),
      `import { defineConfig } from "vite";
export default defineConfig({ build: { lib: { entry: ${JSON.stringify(dependencies["@pstdio/ui"] ? { consumer: "consumer.ts", performance: "performance-example/view.tsx" } : "consumer.ts")}, formats: ["es"] } } });`,
    );
    run(directory, ["node_modules/vite/bin/vite.js", "build"]);
    if (dependencies["@pstdio/ui"]) {
      process.stdout.write(run(directory, [join(repoRoot, "scripts/verify/ui-bundle-boundaries.ts")]));
      const monaco = verifyMonacoPackageAssets(directory);
      console.log(`Resolved @pstdio/ui Monaco files with ${monaco.workers} workers and ${monaco.fonts} fonts.`);
    }
  } else {
    run(directory, ["build", "storage-consumer.ts", "--target=browser", "--outdir=storage-browser"]);
    run(directory, ["storage-consumer.ts"]);
    for (const condition of [[], ["--conditions=source"]]) {
      run(directory, [...condition, "consumer.ts"]);
    }
  }
  console.log(
    `Typechecked ${imports.length} entries and ${react ? "bundled them for the browser with declared peers" : "loaded them in Bun with default and source conditions without React type peers"}.`,
  );
};

export const verifyPublicPackages = (repoRoot: string, packageNames = ["sdk", "ui", "pstdio-workbench", "canvas"]) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-public-packages-"));
  try {
    const packages = packageNames.map((name) => {
      const path = resolve(repoRoot, "packages", name, ".publish");
      const archive = join(root, `${name}.tgz`);
      run(path, ["pm", "pack", "--filename", archive]);
      return { path, archive };
    });
    checkConsumer(root, packages, false, repoRoot);
    checkConsumer(root, packages, true, repoRoot);
    verifyProviderPackageConsumer(root, packages[0]!.archive, repoRoot);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

if (import.meta.main) {
  const names = process.argv.includes("--sdk-only") ? ["sdk"] : process.argv.slice(2);
  verifyPublicPackages(resolve(import.meta.dirname, "../.."), names.length ? names : undefined);
}
