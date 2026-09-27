import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { workspaceSchema } from "pstdio-api-contracts";
import type { ResourceAnchor, WorkspaceTypeProvider } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import { createWorkspaceRoutes } from "../routes";
import { remoteWorkspaceCapabilities } from "../workspace-provider.test-fixture";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let app: OpenAPIHono<AppBindings>;
let previous: { home?: string; defaults?: string };
let cloudAvailable = false;
const createdParams: unknown[] = [];
const cloudProvider: WorkspaceTypeProvider = {
  id: "cloud",
  ref: { kind: "workspace-type", id: "cloud" },
  label: "Cloud environment",
  params: { image: { type: "text", label: "Image", required: true } },
  create: (_context, input) => {
    createdParams.push(input.params);
    return {
      state: "ready",
      executionKind: "remote",
      providerRef: { version: 1, data: { environment: input.workspaceId } },
      capabilities: remoteWorkspaceCapabilities,
    };
  },
  resolve: (_context, input) => ({
    state: "ready",
    executionKind: "remote",
    providerRef: input.providerRef,
    capabilities: remoteWorkspaceCapabilities,
  }),
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "workspace-provider-creation-"));
  previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  app = new OpenAPIHono<AppBindings>();
  app.route(
    "/v1",
    createWorkspaceRoutes({
      ...handle.deps,
      extensionRuntimeCatalog: {
        ...handle.deps.extensionRuntimeCatalog,
        get: async (projectId) => {
          const snapshot = await handle.deps.extensionRuntimeCatalog.get(projectId);
          return {
            ...snapshot,
            runtime: {
              ...snapshot.runtime,
              workspaceTypes: cloudAvailable
                ? [
                    {
                      id: "example.cloud",
                      extensionId: "example.environments",
                      name: "cloud",
                      sourcePath: root,
                      provider: cloudProvider,
                    },
                  ]
                : [],
            },
          };
        },
      },
      workspaceProviderRuntime: { find: async () => ({ context: {} as never, provider: cloudProvider }) },
    }),
  );
});

afterAll(async () => {
  await handle.close();
  await rm(root, { recursive: true, force: true });
  if (previous.home === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previous.home;
  if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
});

const createProject = async (path?: string) => {
  const project = await handle.deps.projectService.create({ name: "Provider choices" });
  await handle.deps.workspaceService.ensureDefault({
    project_id: project.id,
    name: "Project workspace",
    provider_id: path ? "pstdio.root" : "example.cloud",
    root_path: path,
  });
  return project;
};

test("a plain folder has no additional workspace providers", async () => {
  const folder = join(root, "plain");
  await mkdir(folder);
  const project = await createProject(folder);
  const response = await app.request(`/v1/projects/${project.id}/workspace-providers`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
});

test("offers Git creation only after the project folder has a usable commit", async () => {
  const folder = join(root, "git");
  await mkdir(folder);
  execFileSync("git", ["init", "--quiet"], { cwd: folder });
  const project = await createProject(folder);
  const url = `/v1/projects/${project.id}/workspace-providers`;
  expect(await (await app.request(url)).json()).toEqual([]);

  await writeFile(join(folder, "README.md"), "Ready\n");
  execFileSync("git", ["add", "README.md"], { cwd: folder });
  execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "Initial"],
    { cwd: folder },
  );
  expect(await (await app.request(url)).json()).toEqual([
    expect.objectContaining({ id: "pstdio.worktree", params: { base: expect.objectContaining({ required: true }) } }),
  ]);
});

test("offers extension cloud creation without a local folder or Git source", async () => {
  cloudAvailable = true;
  const project = await createProject();
  const response = await app.request(`/v1/projects/${project.id}/workspace-providers`);
  expect(await response.json()).toEqual([
    expect.objectContaining({ id: "example.cloud", label: "Cloud environment", params: cloudProvider.params }),
  ]);
});

test.each(["DOC-7", undefined])("creates an anchored cloud workspace with shorthand base %s", async (shorthandBase) => {
  const project = await createProject();
  const home = await handle.deps.workspaceService.getDefault(project.id);
  const anchors = [
    { type: "document", id: "doc-7", role: "primary", label: "Document 7", metadata: { section: "intro" } },
  ] satisfies ResourceAnchor[];
  const params = { image: "documents" };
  const response = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: project.id,
      provider_id: "example.cloud",
      params,
      anchors,
      shorthand_base: shorthandBase,
    }),
  });
  expect(response.status).toBe(202);
  const workspace = await response.json();
  expect(workspace).toMatchObject({
    project_id: project.id,
    provider_id: "example.cloud",
    provider_params_json: params,
    execution_kind: "remote",
    root_path: null,
    provider_state: "ready",
    workspace_shorthand: shorthandBase ? "DOC-7_A1" : "WS-1",
    anchors_json: anchors,
  });
  expect(workspace.provider_ref_json).toEqual({ version: 1, data: { environment: workspace.id } });
  expect(createdParams.at(-1)).toEqual(params);
  expect(await handle.deps.workspaceService.get(workspace.id)).toMatchObject({ anchors_json: anchors });
  expect(workspaceSchema.parse(workspace).anchors_json).toEqual(anchors);
  expect((await handle.deps.workspaceService.getDefault(project.id))?.id).toBe(home?.id);
});
