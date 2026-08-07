import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionRuntime } from "../types/runtime";
import { checkExtensions, formatCheckReport } from "./check";
import { checkExtensionHostCompatibility, dashboardExtensionHostCapabilities } from "./host-capabilities";

const tempDirs: string[] = [];

const createTempHome = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-ext-check-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, "extensions"), { recursive: true });
  return dir;
};

const writeExtension = (homeRoot: string, name: string, source: string) => {
  const extDir = join(homeRoot, "extensions", name);
  mkdirSync(extDir, { recursive: true });
  writeFileSync(
    join(extDir, "package.json"),
    JSON.stringify(
      {
        name,
        version: "0.1.0",
        displayName: name === "extension-lab" ? "Extension Lab" : name,
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(extDir, "extension.ts"), source);
  return join(extDir, "extension.ts");
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const validExtensionSource = `export default {
  commands: {
    "say-hello": { title: "Say hello", cli: true, run: async () => undefined },
    "counter.bump": { title: "Bump counter", cli: true, run: async () => undefined },
  },
  middlewares: {
    rejectDoomDeletes: {
      command: { id: "planner.tickets.delete" },
      handler: async () => undefined,
    },
  },
  hooks: {
    notifyDoomRejected: {
      event: { id: "command:planner.tickets.delete:rejected" },
      handler: async () => undefined,
    },
  },
  schedules: {
    heartbeat: {
      title: "Heartbeat",
      cron: "0 * * * *",
      command: { id: "extension-lab.say-hello" },
    },
  },
  artifactMounts: {
    tickets: { path: "tickets", label: "Tickets" },
  },
};`;

describe("checkExtensions", () => {
  test("returns empty success when extensions root is missing", async () => {
    const home = createTempHome();
    rmSync(join(home, "extensions"), { recursive: true });

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.extensionsRootExists).toBe(false);
    expect(result.runtime.extensions).toEqual([]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);

    const report = formatCheckReport(result);
    expect(report).toContain("Installed extensions: 0");
    expect(report).toContain("No extensions found in");
  });

  test("loads installed extensions and reports their registrations", async () => {
    const home = createTempHome();
    writeExtension(home, "extension-lab", validExtensionSource);

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.errorCount).toBe(0);
    expect(result.runtime.extensions).toHaveLength(1);
    expect(result.runtime.commands).toHaveLength(2);
    expect(result.runtime.middlewares).toHaveLength(1);
    expect(result.runtime.hooks).toHaveLength(1);
    expect(result.runtime.schedules).toHaveLength(1);
    expect(result.runtime.artifactMounts).toHaveLength(1);

    const report = formatCheckReport(result);
    expect(report).toContain("Extension Lab");
    expect(report).toContain("id:        pstdio.extension-lab");
    expect(report).toContain("name:      extension-lab");
    expect(report).toContain("version:   0.1.0");
    expect(report).toContain("CLI: pstdio extension-lab say-hello");
    expect(report).toContain("CLI: pstdio extension-lab counter bump");
    expect(report).toContain("tickets -> .pstdio/extension-lab/tickets");
  });

  test("reports empty eligible locations panel warnings", async () => {
    const home = createTempHome();
    writeExtension(
      home,
      "extension-lab",
      `export default {
        panels: {
          everywhere: {
            title: "Everywhere",
            region: "main",
            closable: true,
            eligibleLocations: {},
            webview: { entry: "./panel.tsx" },
          },
        },
      };`,
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });

    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(1);
    expect(result.runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "extension_panel_empty_eligible_locations",
        severity: "warning",
        metadata: { contributionId: "extension-lab.everywhere" },
      }),
    ]);

    const report = formatCheckReport(result);
    expect(report).toContain("Warnings: 1");
    expect(report).toContain("warning extension_panel_empty_eligible_locations");
  });

  test("flags invalid default exports", async () => {
    const home = createTempHome();
    writeExtension(home, "broken", `export default "nope";`);

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.runtime.diagnostics.map((d) => d.code)).toContain("invalid_default_export");
  });

  test("flags duplicate extension ids, command ids, and CLI paths", async () => {
    const home = createTempHome();
    const make = () => `export default {
      commands: {
        "counter.bump": { title: "B", cli: { path: ["counter", "bump"] }, run: async () => undefined },
      },
    };`;
    writeExtension(home, "dup-a", make());
    writeExtension(home, "dup-b", make());
    writeFileSync(
      join(home, "extensions", "dup-b", "package.json"),
      JSON.stringify({
        name: "dup-a",
        version: "0.1.0",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
      }),
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    const codes = result.runtime.diagnostics.map((d) => d.code);
    expect(codes).toContain("duplicate_extension_id");
    expect(codes).toContain("duplicate_command_id");
    expect(codes).toContain("duplicate_cli_path");
  });

  test("loads distinct package names without namespace collision", async () => {
    const home = createTempHome();
    writeExtension(home, "ns-a", `export default {};`);
    writeExtension(home, "ns-b", `export default {};`);

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.runtime.extensions.map((ext) => ext.name)).toEqual(["ns-a", "ns-b"]);
  });

  test("flags unsafe artifact mount paths", async () => {
    const home = createTempHome();
    writeExtension(
      home,
      "bad-mount",
      `export default {
        artifactMounts: {
          escape: { path: "../escape", label: "Escape" },
        },
      };`,
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.runtime.diagnostics.map((d) => d.code)).toContain("unsafe_artifact_mount_path");
  });

  test("flags invalid middleware command refs", async () => {
    const home = createTempHome();
    writeExtension(
      home,
      "bad-mw",
      `export default {
        middlewares: {
          orphan: { handler: async () => undefined },
        },
      };`,
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.runtime.diagnostics.map((d) => d.code)).toContain("invalid_middleware_command");
  });

  test("flags invalid schedule command refs", async () => {
    const home = createTempHome();
    writeExtension(
      home,
      "bad-sched",
      `export default {
        schedules: {
          orphan: { title: "Orphan", cron: "0 * * * *" },
        },
      };`,
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.runtime.diagnostics.map((d) => d.code)).toContain("invalid_schedule_command");
  });

  test("reports unverified host compatibility when no descriptor is available", async () => {
    const home = createTempHome();
    writeExtension(home, "extension-lab", validExtensionSource);

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false, hostCapabilities: null });

    expect(result.hostCompatibility.status).toBe("unverified");
    expect(result.warningCount).toBe(1);
    expect(formatCheckReport(result)).toContain("Host compatibility: unverified");
  });
});

describe("checkExtensionHostCompatibility", () => {
  test("flags registered dashboard surfaces when the host does not advertise their bridges", () => {
    const runtime = {
      extensions: [],
      commands: [],
      middlewares: [],
      hooks: [],
      cli: [],
      schedules: [],
      artifactMounts: [],
      modes: [],
      panels: [
        {
          id: "lab.panel",
          localId: "panel",
          extensionId: "pstdio.lab",
          name: "lab",
          sourcePath: "/extension/extension.ts",
          contribution: {
            title: "Rows",
            region: "main",
            closable: true,
            dataTableRenderer: "rows",
            resourceKind: "ticket",
          },
        },
      ],
      routes: [],
      navigation: [],
      treeItems: [],
      settingsSections: [
        {
          id: "lab.section",
          localId: "section",
          extensionId: "pstdio.lab",
          name: "lab",
          sourcePath: "/extension/extension.ts",
          contribution: { title: "Lab" },
        },
      ],
      settingsPanels: [],
      kanbanRenderers: [],
      dataTableRenderers: [
        {
          id: "lab.rows",
          localId: "rows",
          extensionId: "pstdio.lab",
          name: "lab",
          sourcePath: "/extension/extension.ts",
          contribution: { title: "Rows", queryCommand: "query" },
        },
      ],
      commandPaletteResources: [],
      treeRenderers: [],
      fileRenderers: [],
      controlsRenderers: [],
      keybindings: [],
      settings: [],
      templateTypes: [],
      templates: [],
      skills: [],
      themes: [],
      fileIconThemes: [],
      translations: [],
      harnesses: [],
      workspaceTypes: [],
      diagnostics: [],
    } satisfies ExtensionRuntime;
    const host = {
      ...dashboardExtensionHostCapabilities,
      hostVersion: "0.25.1",
      capabilities: Object.fromEntries(
        Object.entries(dashboardExtensionHostCapabilities.capabilities).filter(
          ([name]) =>
            name !== "renderer.data-table.v1" &&
            name !== "panel.data-table-renderer.v1" &&
            name !== "settings.section.v1" &&
            name !== "resource-view.v1",
        ),
      ),
    };

    const result = checkExtensionHostCompatibility(runtime, host);

    expect(result.status).toBe("verified");
    expect(result.diagnostics.map((diagnostic) => diagnostic.metadata?.missingCapability)).toEqual([
      "panel.data-table-renderer.v1",
      "settings.section.v1",
      "renderer.data-table.v1",
      "resource-view.v1",
    ]);
  });
});
