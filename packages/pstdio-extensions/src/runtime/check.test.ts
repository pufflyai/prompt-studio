import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defineExtension,
  defineResourceKind,
  defineResourceView,
  defineSettingsSection,
  defineView,
  resourceSlotRef,
} from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { checkExtensions, formatCheckReport } from "./check";
import { checkExtensionHostCompatibility, dashboardExtensionHostCapabilities } from "./host-capabilities";
import { normalizeExtensionSources } from "./normalize";

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
        engines: { pstdio: EXTENSION_API_VERSION },
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
  commands: [
    { id: "say-hello", ref: { kind: "command", id: "say-hello" }, title: "Say hello", cli: true, run: async () => undefined },
    { id: "counter-bump", ref: { kind: "command", id: "counter-bump" }, title: "Bump counter", cli: true, run: async () => undefined },
  ],
  middlewares: [
    {
      id: "reject-doom-deletes",
      ref: { kind: "middleware", id: "reject-doom-deletes" },
      command: { extensionId: "pstdio.planner", kind: "command", id: "tickets.delete" },
      run: async () => undefined,
    },
  ],
  hooks: [
    {
      id: "notify-doom-rejected",
      ref: { kind: "hook", id: "notify-doom-rejected" },
      event: { extensionId: "pstdio.planner", kind: "event", id: "command.rejected:tickets.delete" },
      run: async () => undefined,
    },
  ],
  schedules: [
    {
      id: "heartbeat",
      ref: { kind: "schedule", id: "heartbeat" },
      title: "Heartbeat",
      schedule: "0 * * * *",
      command: { kind: "command", id: "say-hello" },
    },
  ],
  artifactMounts: [
    { id: "tickets", ref: { kind: "artifact-mount", id: "tickets" }, path: "tickets", label: "Tickets" },
  ],
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
    expect(report).toContain("CLI: pstdio extension-lab counter-bump");
    expect(report).toContain("tickets -> .pstdio/extension-storage/extension-lab/tickets");
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
      commands: [
        { id: "counter-bump", ref: { kind: "command", id: "counter-bump" }, title: "B", cli: { path: ["counter", "bump"] }, run: async () => undefined },
      ],
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
        engines: { pstdio: EXTENSION_API_VERSION },
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
        artifactMounts: [
          { id: "escape", ref: { kind: "artifact-mount", id: "escape" }, path: "../escape", label: "Escape" },
        ],
      };`,
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.runtime.diagnostics.map((d) => d.code)).toContain("unsafe_artifact_mount_path");
  });

  test("flags webview artifact grants on mounts the extension does not define", async () => {
    const home = createTempHome();
    writeExtension(
      home,
      "report-view",
      `export default {
        artifactMounts: [
          { id: "runs", ref: { kind: "artifact-mount", id: "runs" }, path: "runs", label: "Runs" },
        ],
        views: [
          {
            id: "report",
            ref: { kind: "view", id: "report" },
            title: "Report",
            body: {
              kind: "webview",
              entry: { kind: "package-asset", path: "./webviews/report.tsx", baseUrl: "file:///tmp/report-view/" },
              capabilities: ["artifacts.read:runs", "artifacts.read:secrets"],
            },
          },
        ],
      };`,
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    const diagnostics = result.runtime.diagnostics.filter((d) => d.code === "webview_artifact_mount_missing");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain("artifacts.read:secrets");
    expect(diagnostics[0]?.message).toContain('"secrets"');
  });

  test("flags invalid middleware command refs", async () => {
    const home = createTempHome();
    writeExtension(
      home,
      "bad-mw",
      `export default {
        middlewares: [
          { id: "orphan", ref: { kind: "middleware", id: "orphan" }, run: async () => undefined },
        ],
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
        schedules: [
          { id: "orphan", ref: { kind: "schedule", id: "orphan" }, title: "Orphan", schedule: "0 * * * *" },
        ],
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
    const ticket = defineResourceKind({
      id: "ticket",
      surface: "primary",
      slots: [{ id: "inspector", cardinality: "many", access: "public" }],
    });
    const rows = defineView({
      id: "rows",
      title: "Rows",
      body: { kind: "dataTable", columns: [], query: async () => ({ rows: [] }) },
    });
    const runtime = normalizeExtensionSources([
      {
        packagePath: "/extension",
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        manifest: {
          id: "pstdio.lab",
          name: "lab",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: EXTENSION_API_VERSION,
        },
        definition: defineExtension({
          views: [rows],
          resourceKinds: [ticket],
          resourceViews: [
            defineResourceView({
              id: "rows-for-ticket",
              resourceKind: ticket.ref,
              slot: resourceSlotRef(ticket.ref, "inspector"),
              view: rows.ref,
            }),
          ],
          settingsSections: [defineSettingsSection({ id: "lab", title: "Lab" })],
        }),
      },
    ]);
    const host = {
      ...dashboardExtensionHostCapabilities,
      hostVersion: "0.25.1",
      capabilities: Object.fromEntries(
        Object.entries(dashboardExtensionHostCapabilities.capabilities).filter(
          ([name]) => name !== "view.data-table.v1" && name !== "settings.section.v1" && name !== "resource-view.v1",
        ),
      ),
    };

    const result = checkExtensionHostCompatibility(runtime, host);

    expect(result.status).toBe("verified");
    expect(result.diagnostics.map((diagnostic) => diagnostic.metadata?.missingCapability)).toEqual([
      "view.data-table.v1",
      "settings.section.v1",
      "resource-view.v1",
    ]);
  });
});
