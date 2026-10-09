import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { loadExtensionSource } from "./extension-runtime";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { buildExtensionWebview } from "./extension-webview-builder";

const extensionEntry = `export default {views:[{id:"page",title:"Page",body:{kind:"webview",entry:{kind:"package-asset",path:"./main.ts",baseUrl:import.meta.url}}}]};`;

const setup = () => {
  const root = mkdtempSync(join(tmpdir(), "webview-recovery-"));
  const source = join(root, "extension");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "lab",
      publisher: "pstdio",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(source, "extension.ts"), extensionEntry);
  const main = 'import "./main.css"; console.log("ok");';
  writeFileSync(join(source, "main.ts"), main);
  writeFileSync(join(source, "main.css"), '@import "nested.css";');
  writeFileSync(join(source, "nested.css"), 'body { color: red; background: url("./pixel.svg"); }');
  writeFileSync(join(source, "pixel.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><text>one</text></svg>');
  const state = { builds: 0, error: null as unknown, loads: 0 };
  const managers: ReturnType<typeof createExtensionWebviewBuildManager>[] = [];
  const createManager = () => {
    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [{ id: "lab", install_name: "lab", source_path: source }],
      reportBuildFailure: async (_name, _id, error) => {
        state.error = error;
      },
      reportBuildSuccess: async () => {
        state.error = null;
      },
      buildWebview: async (input) => {
        state.builds++;
        return buildExtensionWebview(input);
      },
      loadSource: (sourcePath) => {
        state.loads++;
        return loadExtensionSource(sourcePath);
      },
      webviewCacheRoot: join(root, "cache"),
    });
    managers.push(manager);
    return manager;
  };
  return {
    source,
    main,
    state,
    createManager,
    css: () => readFileSync(join(root, "cache/lab/pstdio.lab.view.page/dist/module.css"), "utf8"),
    dispose: () => {
      for (const manager of managers) manager.dispose();
      rmSync(root, { recursive: true, force: true });
    },
  };
};

test("rebuilds nested CSS imports and referenced assets edited while closed", async () => {
  const fixture = setup();
  try {
    const first = fixture.createManager();
    await first.ensure("lab");
    first.dispose();
    const before = fixture.css();
    writeFileSync(join(fixture.source, "nested.css"), 'body { color: blue; background: url("./pixel.svg"); }');
    const second = fixture.createManager();
    await second.ensure("lab");
    second.dispose();
    const afterCss = fixture.css();
    expect(afterCss).not.toBe(before);
    writeFileSync(join(fixture.source, "pixel.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><text>two</text></svg>');
    await fixture.createManager().ensure("lab");
    expect(fixture.css()).not.toBe(afterCss);
    expect(fixture.state.builds).toBe(3);
  } finally {
    fixture.dispose();
  }
});

test("recovers a persisted build failure when valid source is restored while closed", async () => {
  const fixture = setup();
  try {
    const first = fixture.createManager();
    await first.ensure("lab");
    writeFileSync(join(fixture.source, "main.ts"), "invalid TypeScript !!!");
    await first.refresh(fixture.source);
    expect(fixture.state.error).not.toBeNull();
    first.dispose();
    writeFileSync(join(fixture.source, "main.ts"), fixture.main);
    await fixture.createManager().ensure("lab");
    expect(fixture.state.error).toBeNull();
  } finally {
    fixture.dispose();
  }
});

test("builds webviews once an extension that failed to load has its dependencies installed", async () => {
  const fixture = setup();
  try {
    writeFileSync(join(fixture.source, "extension.ts"), `import "lab-dependency";\n${extensionEntry}`);
    const manager = fixture.createManager();
    await manager.ensure("lab");
    expect(fixture.state.builds).toBe(0);

    const dependency = join(fixture.source, "node_modules/lab-dependency");
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(dependency, "package.json"), JSON.stringify({ name: "lab-dependency", main: "index.js" }));
    writeFileSync(join(dependency, "index.js"), "export {};");
    await manager.ensure("lab");
    expect(fixture.state.builds).toBe(1);
  } finally {
    fixture.dispose();
  }
});

test("does not load a broken extension again until the files it loads change", async () => {
  const fixture = setup();
  try {
    writeFileSync(join(fixture.source, "extension.ts"), 'throw new Error("not ready");');
    const manager = fixture.createManager();
    await manager.ensure("lab");
    await manager.ensure("lab");
    expect(fixture.state.loads).toBe(1);

    writeFileSync(join(fixture.source, "extension.ts"), extensionEntry);
    await manager.ensure("lab");
    expect(fixture.state.loads).toBe(2);
    expect(fixture.state.builds).toBe(1);
  } finally {
    fixture.dispose();
  }
});

test("builds webviews once a gitignored module the extension imports is generated", async () => {
  const fixture = setup();
  try {
    writeFileSync(join(fixture.source, ".gitignore"), "generated/\n");
    writeFileSync(
      join(fixture.source, "extension.ts"),
      'import views from "./generated/views.ts";\nexport default { views };',
    );
    const manager = fixture.createManager();
    await manager.ensure("lab");
    expect(fixture.state.builds).toBe(0);

    mkdirSync(join(fixture.source, "generated"));
    writeFileSync(
      join(fixture.source, "generated/views.ts"),
      `export default [{id:"page",title:"Page",body:{kind:"webview",entry:{kind:"package-asset",path:"../main.ts",baseUrl:import.meta.url}}}];`,
    );
    await manager.ensure("lab");
    expect(fixture.state.builds).toBe(1);
  } finally {
    fixture.dispose();
  }
});

test("loads an extension that failed to load again on refresh", async () => {
  const fixture = setup();
  try {
    writeFileSync(join(fixture.source, "extension.ts"), 'throw new Error("not ready");');
    const manager = fixture.createManager();
    await manager.ensure("lab");
    await manager.refresh(fixture.source);
    expect(fixture.state.loads).toBe(2);
  } finally {
    fixture.dispose();
  }
});
