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
    id: "acme-tools.workspaceNote.set",
    extensionId: "acme.acme-tools",
    title: "Set workspace note",
    cliPath: "acme-tools workspaceNote set",
    cliAliases: ["workspaces set-note"],
  },
];

describe("extensionNamespaceSummaries", () => {
  test("includes canonical extension namespaces for commands without global aliases", () => {
    const summaries = extensionNamespaceSummaries([
      {
        id: "onefin-dev.spinUpApp",
        extensionId: "onefin.onefin-dev",
        title: "Spin up app",
        cliPath: "onefin-dev spinUpApp",
      },
    ]);

    expect(summaries).toEqual([{ namespace: "onefin-dev", description: "onefin-dev" }]);
  });

  test("derives runnable canonical and alias namespaces with their providers", () => {
    expect(extensionNamespaceSummaries(commands)).toEqual([
      { namespace: "acme-tools", description: "acme-tools" },
      { namespace: "pstdio-planner", description: "pstdio-planner" },
      { namespace: "statuses", description: "pstdio-planner" },
      { namespace: "tickets", description: "pstdio-planner" },
      { namespace: "workspaces", description: "acme-tools" },
    ]);
  });

  test("excludes namespaces that collide with static built-ins", () => {
    const summaries = extensionNamespaceSummaries(commands, { exclude: new Set(["workspaces"]) });
    expect(summaries.map((summary) => summary.namespace)).toEqual([
      "acme-tools",
      "pstdio-planner",
      "statuses",
      "tickets",
    ]);
  });

  test("deduplicates canonical cliPath namespaces across commands", () => {
    const namespaces = extensionNamespaceSummaries(commands).map((summary) => summary.namespace);
    expect(namespaces.filter((namespace) => namespace === "pstdio-planner")).toHaveLength(1);
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

    expect(summaries.map((summary) => summary.namespace)).toEqual([
      "acme-tools",
      "pstdio-planner",
      "statuses",
      "tickets",
    ]);
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
