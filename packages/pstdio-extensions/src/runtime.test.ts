import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionRuntime } from "./index";

let tempDirs: string[] = [];

const createProject = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-extensions-test-"));
  tempDirs.push(dir);
  return dir;
};

const writeExtension = (projectRoot: string, extensionDir: string, source: string) => {
  const dir = join(projectRoot, ".pstdio", "extensions", extensionDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "extension.ts"), source);
};

const diagnosticCodes = (runtime: Awaited<ReturnType<typeof loadExtensionRuntime>>) =>
  runtime.diagnostics.map((diagnostic) => diagnostic.code);

const firstPartyExtensionIds = ["pstdio.harness.claude-code", "pstdio.harness.opencode", "pstdio.planner"];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("loadExtensionRuntime", () => {
  test("returns the first-party runtime when the local extensions directory is missing", async () => {
    const runtime = await loadExtensionRuntime({ projectRoot: createProject() });

    expect(runtime.extensions.map((extension) => extension.id).sort()).toEqual(firstPartyExtensionIds);
    expect(runtime.commands).toEqual([]);
    expect(runtime.diagnostics).toEqual([]);
  });

  test("loads and normalizes a valid local extension", async () => {
    const source = `import { defineExtension, params } from "@pstdio/sdk/extensions";

      export default defineExtension({
        id: "project.example",
        name: "Example",
        commands: {
          runReview: {
            title: "Run review",
            target: "workspace",
            params: { harness: params.harness() },
            menus: [{ slot: "workspace.header.primary", order: 10 }],
            cli: {
              path: "workspaces review",
              description: "Start a review session",
              examples: ["pstdio workspaces review --workspace <id>"],
            },
            async run() {},
          },
        },
        artifactMounts: {
          tickets: { path: ".pstdio/tickets", label: "Tickets" },
        },
      });`;

    for (let attempt = 0; attempt < 10; attempt++) {
      const projectRoot = createProject();
      writeExtension(projectRoot, "example", source);
      const runtime = await loadExtensionRuntime({ projectRoot });

      expect(runtime.diagnostics).toEqual([]);
      const extension = runtime.extensions.find((candidate) => candidate.id === "project.example");
      expect(extension?.id).toBe("project.example");
      expect(extension?.sourceKind).toBe("local");
      expect(runtime.commands[0]?.id).toBe("project.example.runReview");
      expect(runtime.commands[0]?.cli?.pathSegments).toEqual(["workspaces", "review"]);
      expect(runtime.artifactMounts[0]?.path).toBe(".pstdio/tickets");
    }
  });

  test("reports invalid exports and invalid extension ids as diagnostics", async () => {
    const projectRoot = createProject();
    writeExtension(projectRoot, "missing-default", `export const value = 1;`);
    writeExtension(
      projectRoot,
      "invalid-id",
      `export default {
        id: "Local Review",
        name: "Invalid",
      };`,
    );

    const runtime = await loadExtensionRuntime({ projectRoot });

    expect(diagnosticCodes(runtime)).toContain("invalid_export");
    expect(diagnosticCodes(runtime)).toContain("invalid_extension_id");
    expect(runtime.extensions.map((extension) => extension.id).sort()).toEqual(firstPartyExtensionIds);
  });

  test("reports duplicate providers and excludes unsafe artifact mounts", async () => {
    const projectRoot = createProject();
    const first = `export default {
      id: "project.duplicates",
      name: "Duplicates A",
      commands: {
        run: {
          title: "Run",
          cli: { path: "tickets pull" },
          run() {},
        },
      },
      artifactMounts: {
        tickets: { path: ".pstdio/tickets", label: "Tickets" },
        unsafe: { path: "../secrets", label: "Secrets" },
      },
    };`;
    const second = `export default {
      id: "project.duplicates",
      name: "Duplicates B",
      commands: {
        run: {
          title: "Run again",
          cli: { path: "tickets pull" },
          run() {},
        },
      },
      artifactMounts: {
        tickets: { path: ".pstdio/tickets/", label: "Tickets Copy" },
      },
    };`;
    writeExtension(projectRoot, "a", first);
    writeExtension(projectRoot, "b", second);

    const runtime = await loadExtensionRuntime({ projectRoot });

    expect(diagnosticCodes(runtime)).toContain("duplicate_extension_id");
    expect(diagnosticCodes(runtime)).toContain("duplicate_command_id");
    expect(diagnosticCodes(runtime)).toContain("duplicate_cli_path");
    expect(diagnosticCodes(runtime)).toContain("unsafe_artifact_mount_path");
    expect(diagnosticCodes(runtime)).toContain("duplicate_artifact_mount");
    expect(runtime.artifactMounts).toHaveLength(1);
    expect(runtime.diagnostics.find((diagnostic) => diagnostic.code === "duplicate_cli_path")?.related).toEqual(
      expect.arrayContaining([expect.objectContaining({ commandId: "project.duplicates.run", path: "tickets pull" })]),
    );
  });

  test("reports invalid package asset references", async () => {
    const projectRoot = createProject();
    writeExtension(
      projectRoot,
      "templates",
      `export default {
        id: "project.templates",
        name: "Templates",
        templateTypes: {
          ticket: { label: "Ticket" },
        },
        templates: {
          defaultTicket: {
            title: "Default Ticket",
            type: "ticket",
            source: "../templates/default-ticket.md",
          },
        },
      };`,
    );

    const runtime = await loadExtensionRuntime({ projectRoot });

    expect(diagnosticCodes(runtime)).toContain("invalid_package_asset");
    expect(runtime.templates).toEqual([]);
  });
});
