import { describe, expect, mock, test } from "bun:test";
import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import { extensionNamespaceSummaries, loadExtensionNamespaces } from "./root-help-namespaces";

const commands: ExtensionCommandRecord[] = [
  {
    id: "pstdio-planner.create-ticket",
    extensionId: "pstdio.planner",
    title: "Create ticket",
    cliPath: "pstdio.planner create-ticket",
  },
  {
    id: "pstdio-planner.ticketStatus.read",
    extensionId: "pstdio.planner",
    title: "List statuses",
    cliPath: "pstdio.planner ticket-status read",
  },
  {
    id: "acme-tools.workspaceNote.set",
    extensionId: "acme.acme-tools",
    title: "Set workspace note",
    cliPath: "acme.acme-tools workspaceNote set",
  },
];

describe("extensionNamespaceSummaries", () => {
  test("includes the owning extension namespace for CLI commands", () => {
    const summaries = extensionNamespaceSummaries([
      {
        id: "onefin-dev.spinUpApp",
        extensionId: "onefin.onefin-dev",
        title: "Spin up app",
        cliPath: "onefin.onefin-dev spinUpApp",
      },
    ]);

    expect(summaries).toEqual([{ namespace: "onefin.onefin-dev", description: "onefin.onefin-dev" }]);
  });

  test("derives runnable canonical namespaces with their providers", () => {
    expect(extensionNamespaceSummaries(commands)).toEqual([
      { namespace: "acme.acme-tools", description: "acme.acme-tools" },
      { namespace: "pstdio.planner", description: "pstdio.planner" },
    ]);
  });

  test("excludes namespaces that collide with static built-ins", () => {
    const summaries = extensionNamespaceSummaries(commands, { exclude: new Set(["acme.acme-tools"]) });
    expect(summaries.map((summary) => summary.namespace)).toEqual(["pstdio.planner"]);
  });

  test("deduplicates canonical cliPath namespaces across commands", () => {
    const namespaces = extensionNamespaceSummaries(commands).map((summary) => summary.namespace);
    expect(namespaces.filter((namespace) => namespace === "pstdio.planner")).toHaveLength(1);
  });
});

describe("loadExtensionNamespaces", () => {
  test("returns summaries when project context and API are available", async () => {
    const summaries = await loadExtensionNamespaces({
      healthUrl: "http://localhost:19840/healthz",
      exclude: new Set(["acme.acme-tools"]),
      deps: {
        resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
        isHealthy: mock(async () => true),
        listCommands: mock(async () => ({ commands, diagnostics: [] })),
      },
    });

    expect(summaries.map((summary) => summary.namespace)).toEqual(["pstdio.planner"]);
  });

  test("stays offline-safe: returns [] when the API is unreachable", async () => {
    const listCommands = mock(async () => ({ commands, diagnostics: [] }));

    const summaries = await loadExtensionNamespaces({
      healthUrl: "http://localhost:19840/healthz",
      deps: {
        resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
        isHealthy: mock(async () => false),
        listCommands,
      },
    });

    expect(summaries).toEqual([]);
    expect(listCommands).not.toHaveBeenCalled();
  });

  test("returns [] when there is no project context", async () => {
    const summaries = await loadExtensionNamespaces({
      healthUrl: "http://localhost:19840/healthz",
      deps: {
        resolveProjectId: () => {
          throw new Error("No project specified.");
        },
        isHealthy: mock(async () => true),
        listCommands: mock(async () => ({ commands, diagnostics: [] })),
      },
    });

    expect(summaries).toEqual([]);
  });
});

test("root discovery advertises canonical namespaces during identity upgrades", () => {
  expect(
    extensionNamespaceSummaries([
      {
        id: "pstdio.notes.command.notes.create",
        extensionId: "pstdio.notes",
        title: "New note",
        cliPath: "pstdio.notes create",
        cliAliases: ["pstdio.pstdio-notes notes create", "pstdio-notes notes create", "pstdio.notes notes create"],
      },
    ]),
  ).toEqual([{ namespace: "pstdio.notes", description: "pstdio.notes" }]);
});
