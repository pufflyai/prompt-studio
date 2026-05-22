import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { commandEvent, commandRef, defineExtension, packageAsset, projectSlots } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const tempDirs: string[] = [];

const createAssetExtensionRoot = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-appearance-"));
  tempDirs.push(dir);
  const entrypoint = join(dir, "extension.ts");
  writeFileSync(entrypoint, "export default {};\n");
  return { dir, entrypoint, baseUrl: pathToFileURL(entrypoint).href };
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const wrap = (name: string, definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

const wrapAt = (
  name: string,
  sourcePath: string,
  definition: ReturnType<typeof defineExtension>,
): LoadedExtensionSource => ({
  ...wrap(name, definition),
  packagePath: sourcePath.replace(/\/extension\.ts$/, ""),
  sourcePath,
});

describe("normalizeExtensionSources", () => {
  test("registers commands with namespace-scoped CLI paths", () => {
    const planner = defineExtension({
      commands: {
        "tickets.create": {
          title: "Create ticket",
          cli: true,
          run: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("planner", planner)]);
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.commands).toHaveLength(1);
    expect(runtime.commands[0]).toMatchObject({
      id: "planner.tickets.create",
      localId: "tickets.create",
      extensionId: "pstdio.planner",
      name: "planner",
      title: "Create ticket",
    });
    expect(runtime.cli).toHaveLength(1);
    expect(runtime.cli[0]).toMatchObject({
      name: "planner",
      path: ["tickets", "create"],
      pathKey: "planner tickets create",
    });
  });

  test("uses custom CLI path when provided", () => {
    const planner = defineExtension({
      commands: {
        "tickets.create": {
          title: "Create ticket",
          cli: { path: ["tickets", "new"] },
          run: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("planner", planner)]);
    expect(runtime.cli[0]?.path).toEqual(["tickets", "new"]);
  });

  test("flags duplicate command ids and CLI collisions", () => {
    const a = defineExtension({
      commands: {
        "tickets.create": { title: "A", cli: true, run: async () => undefined },
      },
    });
    const b = defineExtension({
      commands: {
        "tickets.create": { title: "B", cli: true, run: async () => undefined },
      },
    });

    const runtime = normalizeExtensionSources([wrap("planner", a), wrap("planner", b)]);
    const codes = runtime.diagnostics.map((d) => d.code);
    expect(codes).toContain("duplicate_extension_id");
    expect(codes).toContain("duplicate_command_id");
    expect(codes).toContain("duplicate_cli_path");
  });
});

describe("normalizeExtensionSources runtime records", () => {
  test("registers middlewares against typed command refs", () => {
    const labAwaken = commandRef("lab.awaken");
    const lab = defineExtension({
      commands: {
        awaken: { title: "Awaken", run: async () => undefined },
      },
      middlewares: {
        rejectSentience: {
          command: labAwaken,
          handler: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);
    expect(runtime.middlewares).toHaveLength(1);
    expect(runtime.middlewares[0]).toMatchObject({
      id: "lab.rejectSentience",
      commandId: "lab.awaken",
    });
  });

  test("registers hooks against event refs and command lifecycle events", () => {
    const labAwaken = commandRef("lab.awaken");
    const lab = defineExtension({
      commands: {
        awaken: { title: "Awaken", run: async () => undefined },
      },
      hooks: {
        onRejected: {
          event: commandEvent(labAwaken, "rejected"),
          handler: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);
    expect(runtime.hooks).toHaveLength(1);
    expect(runtime.hooks[0]?.eventId).toBe("command.rejected:lab.awaken");
  });

  test("registers artifact mounts under .pstdio/<name>/", () => {
    const planner = defineExtension({
      artifactMounts: {
        tickets: { path: "tickets", label: "Tickets" },
      },
    });

    const runtime = normalizeExtensionSources([wrap("planner", planner)]);
    expect(runtime.artifactMounts[0]).toMatchObject({
      relativePath: "tickets",
      fullPath: ".pstdio/planner/tickets",
    });
  });

  test("rejects artifact mounts that escape the namespace", () => {
    const bad = defineExtension({
      artifactMounts: {
        escape: { path: "../escape", label: "Escape" },
      },
    });

    const runtime = normalizeExtensionSources([wrap("bad", bad)]);
    expect(runtime.artifactMounts).toEqual([]);
    expect(runtime.diagnostics.map((d) => d.code)).toContain("unsafe_artifact_mount_path");
  });
});

describe("normalizeExtensionSources diagnostics", () => {
  test("rejects duplicate extension ids", () => {
    const bad = defineExtension({});

    const runtime = normalizeExtensionSources([wrap("bad", bad), wrap("bad", bad)]);
    expect(runtime.diagnostics.map((d) => d.code)).toContain("duplicate_extension_id");
  });

  test("collects templates and skills with package assets", () => {
    const planner = defineExtension({
      templateTypes: {
        ticket: { label: "Ticket" },
      },
      templates: {
        defaultTicket: {
          title: "Default Ticket",
          type: "ticket",
          source: packageAsset("./templates/default.md", "file:///fake/extension.ts"),
        },
      },
      skills: {
        triage: {
          title: "Triage",
          source: packageAsset("./skills/triage.md", "file:///fake/extension.ts"),
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("planner", planner)]);
    expect(runtime.templateTypes).toHaveLength(1);
    expect(runtime.templates).toHaveLength(1);
    expect(runtime.skills).toHaveLength(1);
  });

  test("collects theme and file icon theme contributions with package assets", () => {
    const root = createAssetExtensionRoot();
    writeFileSync(
      join(root.dir, "monokai.json"),
      `{
        // VS Code themes are JSONC and commonly include trailing commas.
        "colors": { "editor.background": "#272822", "editor.foreground": "#f8f8f2", },
        "tokenColors": [{ "scope": "comment", "settings": { "foreground": "#75715e", "fontStyle": "italic", }, },],
      }`,
    );
    writeFileSync(join(root.dir, "seti.json"), `{ "iconDefinitions": {}, "fileExtensions": {}, }`);

    const lab = defineExtension({
      themes: {
        monokai: {
          title: "Monokai",
          format: "vscode-color-theme",
          mode: "dark",
          source: packageAsset("./monokai.json", root.baseUrl),
        },
      },
      fileIconThemes: {
        seti: {
          title: "Seti",
          format: "vscode-file-icon-theme",
          source: packageAsset("./seti.json", root.baseUrl),
        },
      },
    });

    const runtime = normalizeExtensionSources([wrapAt("lab", root.entrypoint, lab)]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.themes[0]).toMatchObject({
      id: "lab.monokai",
      title: "Monokai",
      format: "vscode-color-theme",
      mode: "dark",
      preference: {
        id: "lab.monokai",
        mode: "dark",
        tokens: {
          "colors.bg": "#272822",
          "colors.fg": "#f8f8f2",
          "colors.vscode.editor.background": "#272822",
          "colors.vscode.editor.foreground": "#f8f8f2",
        },
      },
      monacoTheme: {
        base: "vs-dark",
        rules: [{ token: "comment", foreground: "75715e", fontStyle: "italic" }],
      },
    });
    expect(runtime.fileIconThemes[0]).toMatchObject({
      id: "lab.seti",
      title: "Seti",
      format: "vscode-file-icon-theme",
    });
  });

  test("reports malformed appearance assets without dropping records", () => {
    const root = createAssetExtensionRoot();
    writeFileSync(join(root.dir, "broken.json"), "{ nope");

    const lab = defineExtension({
      themes: {
        broken: {
          title: "Broken",
          format: "vscode-color-theme",
          source: packageAsset("./broken.json", root.baseUrl),
        },
      },
    });

    const runtime = normalizeExtensionSources([wrapAt("lab", root.entrypoint, lab)]);

    expect(runtime.themes).toHaveLength(1);
    expect(runtime.diagnostics.map((d) => d.code)).toContain("malformed_theme_asset");
  });

  test("rejects duplicate appearance contribution ids", () => {
    const root = createAssetExtensionRoot();
    writeFileSync(join(root.dir, "theme.json"), JSON.stringify({ colors: {} }));
    writeFileSync(join(root.dir, "icons.json"), JSON.stringify({ iconDefinitions: {} }));
    const first = defineExtension({
      themes: {
        monokai: {
          title: "Monokai",
          format: "vscode-color-theme",
          source: packageAsset("./theme.json", root.baseUrl),
        },
      },
      fileIconThemes: {
        seti: {
          title: "Seti",
          format: "vscode-file-icon-theme",
          source: packageAsset("./icons.json", root.baseUrl),
        },
      },
    });
    const second = defineExtension({
      themes: {
        monokai: {
          title: "Monokai Again",
          format: "vscode-color-theme",
          source: packageAsset("./theme.json", root.baseUrl),
        },
      },
      fileIconThemes: {
        seti: {
          title: "Seti Again",
          format: "vscode-file-icon-theme",
          source: packageAsset("./icons.json", root.baseUrl),
        },
      },
    });

    const runtime = normalizeExtensionSources([
      wrapAt("dup", root.entrypoint, first),
      wrapAt("dup", root.entrypoint, second),
    ]);

    expect(runtime.themes.map((theme) => theme.id)).toEqual(["dup.monokai"]);
    expect(runtime.fileIconThemes.map((theme) => theme.id)).toEqual(["dup.seti"]);
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("duplicate_theme_id");
    expect(runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("duplicate_file_icon_theme_id");
  });

  test("emits missing_template_asset and missing_skill_asset diagnostics for unresolved assets", () => {
    const planner = defineExtension({
      templates: {
        defaultTicket: {
          title: "Default Ticket",
          type: "ticket",
          source: packageAsset("./missing-template.md", "file:///fake/extension.ts"),
        },
      },
      skills: {
        triage: {
          title: "Triage",
          source: packageAsset("./missing-skill.md", "file:///fake/extension.ts"),
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("planner", planner)]);
    const codes = runtime.diagnostics.map((d) => d.code);
    expect(codes).toContain("missing_template_asset");
    expect(codes).toContain("missing_skill_asset");
    // Templates and skills with missing assets are still listed so the registry
    // can surface them as unavailable rather than silently dropping them.
    expect(runtime.templates).toHaveLength(1);
    expect(runtime.skills).toHaveLength(1);
  });

  test("reports incompatible slot kinds", () => {
    const lab = defineExtension({
      commands: {
        "say-hello": {
          title: "Say hello",
          menus: [{ slot: projectSlots.sidebar as never, label: "Wrong kind" }],
          run: async () => undefined,
        },
      },
      views: {
        sidebar: {
          title: "Sidebar",
          slot: projectSlots.headerPrimary as never,
          webview: {
            entry: packageAsset("./dist/sidebar.js", "file:///fake/extension.ts"),
          },
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", lab)]);

    expect(runtime.commands[0]?.menus).toEqual([]);
    expect(runtime.views).toEqual([]);
    expect(runtime.diagnostics.map((d) => d.code)).toEqual(["invalid_slot_kind", "invalid_slot_kind"]);
  });
});
