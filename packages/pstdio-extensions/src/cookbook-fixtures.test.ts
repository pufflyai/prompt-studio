import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadExtensionRuntime } from "./index";

const cookbookProjectRoot = join(import.meta.dir, "__fixtures__", "cookbook-project");

describe("cookbook fixture extensions", () => {
  test("compile against the extension SDK and load through the runtime", async () => {
    const runtime = await loadExtensionRuntime({ projectRoot: cookbookProjectRoot });

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.extensions.map((extension) => extension.id).sort()).toEqual([
      "project.review",
      "project.templates",
      "project.wrapper",
      "pstdio.harness.opencode",
      "pstdio.tickets",
    ]);

    expect(runtime.commands.map((command) => command.id).sort()).toEqual([
      "project.review.runReview",
      "project.wrapper.refresh",
      "pstdio.tickets.pullTickets",
      "pstdio.tickets.pushTickets",
    ]);
    expect(runtime.cli.map((cli) => cli.path).sort()).toEqual(["tickets pull", "tickets push", "workspaces review"]);
    expect(runtime.artifactMounts.map((mount) => mount.path)).toEqual([".pstdio/tickets"]);
    expect(runtime.templateTypes[0]?.id).toBe("project.templates.ticket");
    expect(runtime.templates[0]?.source.kind).toBe("package-asset");
    expect(runtime.harnesses[0]?.id).toBe("pstdio.harness.opencode");
  });
});
