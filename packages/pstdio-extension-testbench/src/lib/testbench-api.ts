import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type {
  ResourceRef as ExtensionResourceRef,
  JsonObject,
  WorkbenchAttachmentInvocationContext,
} from "@pstdio/sdk/extensions";
import {
  createCommandRunner,
  type ExtensionRuntime,
  loadExtensionSources,
  normalizeExtensionSources,
} from "pstdio-extensions";
import { createWorkbenchExtensionMetadata, type ResolveWorkbenchExtensionWebview } from "pstdio-extensions/workbench";
import type { ExtensionBenchCommandRequest, ExtensionBenchLoadResponse } from "./api-contract";
import { type BenchStorageSeed, createBenchEnvironment } from "./testbench-environment";
import { createPreviewWebviewHost } from "./webviews";

type ExtensionBench = Awaited<ReturnType<typeof loadExtensionBench>>;

interface ExtensionTestbenchApiInput {
  apiPrefix: string;
  repoRoot: string;
}

interface LoadExtensionBenchInput {
  projectId?: string;
  resolveWebview?: ResolveWorkbenchExtensionWebview;
  sourcePath: string;
  storage?: BenchStorageSeed;
}

const defaultProjectId = "extension-testbench";
const defaultSourcePath = "./extensions/pstdio-planner";

const createBenchContributionInventory = (runtime: ExtensionRuntime) => ({
  templateTypes: runtime.templateTypes.map((type) => ({
    id: type.id,
    extensionId: type.extensionId,
    label: type.contribution.label,
    description: type.contribution.description,
  })),
  templates: runtime.templates.map((template) => ({
    id: template.id,
    extensionId: template.extensionId,
    title: template.contribution.title,
    description: template.contribution.description,
    type: template.contribution.type,
    sourcePath: template.contribution.source.path,
  })),
  skills: runtime.skills.map((skill) => ({
    id: skill.id,
    extensionId: skill.extensionId,
    title: skill.contribution.title,
    description: skill.contribution.description,
    sourcePath: skill.contribution.source.path,
  })),
});

const loadExtensionBench = async (input: LoadExtensionBenchInput) => {
  const projectId = input.projectId ?? defaultProjectId;
  const loaded = await loadExtensionSources({
    extensionPackages: [{ path: resolve(input.sourcePath), sourceKind: "local_path" }],
  });
  const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
  const metadata = createWorkbenchExtensionMetadata({ resolveWebview: input.resolveWebview, runtime });
  const inventory = createBenchContributionInventory(runtime);
  const environment = createBenchEnvironment(input.storage);
  const runner = createCommandRunner(runtime, { buildEnvironment: () => environment });

  const executeCommand = async (commandId: string, request: CommandExecuteRequest) => {
    const command = runtime.commands.find((candidate) => candidate.id === commandId);
    if (!command) throw new Error(`Extension command not found: ${commandId}`);

    const outcome = await runner.execute({
      commandId,
      projectId: request.projectId,
      params: request.params as JsonObject | undefined,
      resource: request.resource as ExtensionResourceRef | undefined,
      attachment: request.attachment as WorkbenchAttachmentInvocationContext | undefined,
      slot: request.slot,
      repo: request.repo,
      source: request.source,
      metadata: request.metadata as JsonObject | undefined,
    });

    return { commandId, extensionId: command.extensionId, outcome };
  };

  return {
    executeCommand,
    inventory,
    metadata,
    projectId,
    summary: {
      commands: runtime.commands.length,
      diagnostics: runtime.diagnostics.length,
      extensions: runtime.extensions.length,
      skills: runtime.skills.length,
      templateTypes: runtime.templateTypes.length,
      templates: runtime.templates.length,
      treeRenderers: runtime.treeRenderers.length,
      views: runtime.views.length,
    },
  };
};

const createPreviewStorage = (): BenchStorageSeed => {
  const now = new Date(0).toISOString();

  return {
    collections: {
      tickets: {
        "PS-16": {
          id: "PS-16",
          shorthand: "PS-16",
          title: "Tree renderer preview",
          content: "# Tree renderer preview\n\nUse this ticket resource to inspect extension tree contributions.",
          statusId: null,
          archived: false,
          sortOrder: 0,
          files: [
            {
              id: "requirements",
              name: "requirements.md",
              content: "Preview the tree renderer outside the dashboard.",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "notes",
              name: "notes.md",
              content: "Click tree rows to exercise contributed command targets.",
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

const createApiHome = () => {
  if (process.env.PSTDIO_HOME) return () => {};
  const home = mkdtempSync(join(tmpdir(), "pstdio-extension-testbench-"));
  process.env.PSTDIO_HOME = home;
  return () => rmSync(home, { recursive: true, force: true });
};

const toLoadResponse = (benchId: string, sourcePath: string, bench: ExtensionBench) =>
  ({
    benchId,
    inventory: bench.inventory,
    metadata: bench.metadata,
    projectId: bench.projectId,
    sourcePath,
    summary: bench.summary,
  }) satisfies ExtensionBenchLoadResponse;

export const createExtensionTestbenchApi = (input: ExtensionTestbenchApiInput) => {
  const benches = new Map<string, ExtensionBench>();
  const cleanupHome = createApiHome();
  let apiOrigin: string | undefined;
  const webviewHost = createPreviewWebviewHost({
    apiOrigin: () => apiOrigin,
    apiPrefix: input.apiPrefix,
    cacheRoot: mkdtempSync(join(tmpdir(), "pstdio-extension-testbench-webviews-")),
  });
  let benchCounter = 0;

  const normalizeSourcePath = (sourcePath: string | null) => {
    const value = sourcePath?.trim() || defaultSourcePath;
    return isAbsolute(value) ? value : resolve(input.repoRoot, value);
  };

  const loadBench = async (url: URL) => {
    const sourcePath = normalizeSourcePath(url.searchParams.get("source"));
    const bench = await loadExtensionBench({
      resolveWebview: webviewHost.resolveWebview,
      sourcePath,
      storage: createPreviewStorage(),
    });
    const benchId = `bench-${++benchCounter}`;
    benches.set(benchId, bench);
    return toLoadResponse(benchId, sourcePath, bench);
  };

  const executeCommand = async (request: Request) => {
    const body = (await request.json()) as ExtensionBenchCommandRequest;
    const bench = benches.get(body.benchId);
    if (!bench) return json({ error: `Unknown extension bench: ${body.benchId}` }, 404);
    return json(await bench.executeCommand(body.commandId, body.request));
  };

  const handleRequest = async (request: Request) => {
    try {
      const url = new URL(request.url);
      apiOrigin = request.headers.get("x-pstdio-testbench-origin") ?? apiOrigin;
      const webviewResponse = webviewHost.handleRequest(url);
      if (webviewResponse) return webviewResponse;

      if (request.method === "GET" && url.pathname === `${input.apiPrefix}/load`) {
        return json(await loadBench(url));
      }

      if (request.method === "POST" && url.pathname === `${input.apiPrefix}/command`) {
        return await executeCommand(request);
      }

      return undefined;
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  };

  return {
    cleanup: () => {
      cleanupHome();
      webviewHost.cleanup();
    },
    handleRequest,
  };
};
