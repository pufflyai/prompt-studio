import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkExtensions, formatCheckReport } from "./check";

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
  writeFileSync(join(extDir, "extension.ts"), source);
  return join(extDir, "extension.ts");
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const validExtensionSource = `export default {
  id: "pstdio.extension-lab",
  namespace: "lab",
  name: "Extension Lab",
  version: "0.1.0",
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
      command: { id: "lab.say-hello" },
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
    expect(report).toContain("namespace: lab");
    expect(report).toContain("version:   0.1.0");
    expect(report).toContain("CLI: pstdio lab say-hello");
    expect(report).toContain("CLI: pstdio lab counter bump");
    expect(report).toContain("tickets -> .pstdio/lab/tickets");
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
    const make = (ns: string) => `export default {
      id: "pstdio.dup",
      namespace: "${ns}",
      name: "Dup",
      commands: {
        "counter.bump": { title: "B", cli: { path: ["counter", "bump"] }, run: async () => undefined },
      },
    };`;
    writeExtension(home, "dup-a", make("dup"));
    writeExtension(home, "dup-b", make("dup"));

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    const codes = result.runtime.diagnostics.map((d) => d.code);
    expect(codes).toContain("duplicate_extension_id");
    expect(codes).toContain("duplicate_command_id");
    expect(codes).toContain("duplicate_cli_path");
  });

  test("flags duplicate namespaces across distinct extension ids", async () => {
    const home = createTempHome();
    writeExtension(
      home,
      "ns-a",
      `export default {
        id: "pstdio.ns-a",
        namespace: "shared",
        name: "A",
      };`,
    );
    writeExtension(
      home,
      "ns-b",
      `export default {
        id: "pstdio.ns-b",
        namespace: "shared",
        name: "B",
      };`,
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.runtime.diagnostics.map((d) => d.code)).toContain("duplicate_namespace");
  });

  test("flags unsafe artifact mount paths", async () => {
    const home = createTempHome();
    writeExtension(
      home,
      "bad-mount",
      `export default {
        id: "pstdio.bad-mount",
        namespace: "badmount",
        name: "Bad mount",
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
        id: "pstdio.bad-mw",
        namespace: "badmw",
        name: "Bad mw",
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
        id: "pstdio.bad-sched",
        namespace: "badsched",
        name: "Bad sched",
        schedules: {
          orphan: { title: "Orphan", cron: "0 * * * *" },
        },
      };`,
    );

    const result = await checkExtensions({ homeRoot: home, includeUserRoot: false });
    expect(result.runtime.diagnostics.map((d) => d.code)).toContain("invalid_schedule_command");
  });
});
