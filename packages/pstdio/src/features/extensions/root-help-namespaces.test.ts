import { describe, expect, mock, test } from "bun:test";
import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import { extensionNamespaceSummaries, loadExtensionNamespaces } from "./root-help-namespaces";

const commands: ExtensionCommandRecord[] = [
  {
    id: "pstdio-planner.create-ticket",
    extensionId: "pstdio.pstdio-planner",
    title: "Create ticket",
    cliPath: "pstdio-planner create-ticket",
    cliAliases: ["tickets create", "tickets add"],
  },
  {
    id: "pstdio-planner.ticketStatus.read",
    extensionId: "pstdio.pstdio-planner",
    title: "List statuses",
    cliPath: "pstdio-planner ticketStatus read",
    cliAliases: ["statuses list"],
  },
  {
    id: "pstdio-planner.workspaceStatus.set",
    extensionId: "pstdio.pstdio-planner",
    title: "Set workspace status",
    cliPath: "pstdio-planner workspaceStatus set",
    cliAliases: ["workspaces set-status"],
  },
];

describe("extensionNamespaceSummaries", () => {
  test("derives user-facing alias namespaces and their providers", () => {
    expect(extensionNamespaceSummaries(commands)).toEqual([
      { namespace: "statuses", description: "pstdio-planner" },
      { namespace: "tickets", description: "pstdio-planner" },
      { namespace: "workspaces", description: "pstdio-planner" },
    ]);
  });

  test("excludes namespaces that collide with static built-ins", () => {
    const summaries = extensionNamespaceSummaries(commands, { exclude: new Set(["workspaces"]) });
    expect(summaries.map((summary) => summary.namespace)).toEqual(["statuses", "tickets"]);
  });

  test("ignores extension-id-scoped canonical cliPath namespaces", () => {
    const namespaces = extensionNamespaceSummaries(commands).map((summary) => summary.namespace);
    expect(namespaces).not.toContain("pstdio-planner");
  });
});

describe("loadExtensionNamespaces", () => {
  test("returns summaries when project context and API are available", async () => {
    const summaries = await loadExtensionNamespaces({
      healthUrl: "http://localhost:19840/healthz",
      exclude: new Set(["workspaces"]),
      deps: {
        resolveProjectId: () => ({ projectId: "project-1", root: "/repo" }),
        isHealthy: mock(async () => true),
        listCommands: mock(async () => ({ commands, diagnostics: [] })),
      },
    });

    expect(summaries.map((summary) => summary.namespace)).toEqual(["statuses", "tickets"]);
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
