import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { loadExtensionRuntime } from "./runtime";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-ext-runtime-"));
  tempDirs.push(dir);
  return dir;
};

const writePackage = (dir: string, name: string, fields: Record<string, unknown> = {}) => {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name,
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
        ...fields,
      },
      null,
      2,
    ),
  );
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("loadExtensionRuntime", () => {
  test("loads extensions from a custom root and normalizes their commands", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "lab"));
    writePackage(join(root, "lab"), "lab", { displayName: "Lab" });
    writeFileSync(
      join(root, "lab", "extension.ts"),
      `export default {
        commands: [
          {
            id: "say-hello",
            ref: { kind: "command", id: "say-hello" },
            title: "Say hello",
            cli: true,
            run: async () => ({ message: "hi" }),
          },
        ],
      };`,
    );

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.extensions).toHaveLength(1);
    expect(runtime.commands).toHaveLength(1);
    expect(runtime.commands[0]?.id).toBe("pstdio.lab.command.say-hello");
    expect(runtime.cli[0]?.pathKey).toBe("lab say-hello");
  });

  test("reports diagnostics when an extension has invalid manifest identity", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "bad"));
    writePackage(join(root, "bad"), "Bad Id");
    writeFileSync(join(root, "bad", "extension.ts"), `export default {};`);

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics.map((d) => d.code)).toContain("extension_manifest_invalid_value");
  });

  test("reports diagnostics when default export is not an object", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "broken"));
    writePackage(join(root, "broken"), "broken");
    writeFileSync(join(root, "broken", "extension.ts"), `export default "nope";`);

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics.map((d) => d.code)).toContain("invalid_default_export");
  });

  test("accepts views with separate docked placements", async () => {
    const root = createTempDir();
    mkdirSync(join(root, "lab"));
    writePackage(join(root, "lab"), "lab");
    writeFileSync(
      join(root, "lab", "extension.ts"),
      `const projectMode = { extensionId: "pstdio", kind: "mode", id: "project" };
      const content = { id: "content", ref: { kind: "view", id: "content" }, title: "Content", body: { kind: "dataTable", query: async () => ({ rows: [] }) } };
      const tickets = { id: "tickets", ref: { kind: "view", id: "tickets" }, title: "Tickets", body: { kind: "dataTable", query: async () => ({ rows: [] }) } };
      export default {
        views: [content, tickets],
        placements: [
          { id: "content", ref: { kind: "placement", id: "content" }, mode: projectMode, item: { kind: "view", view: content.ref }, region: "main" },
          { id: "tickets", ref: { kind: "placement", id: "tickets" }, mode: projectMode, item: { kind: "view", view: tickets.ref }, region: "main", movableTo: ["main", "side"] },
        ],
      };`,
    );

    const runtime = await loadExtensionRuntime({
      includeUserRoot: false,
      extensionRoots: [{ path: root }],
    });

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.views.map((view) => view.localId)).toEqual(["content", "tickets"]);
    expect(runtime.placements.map((placement) => placement.contribution.region)).toEqual(["main", "main"]);
  });
});
