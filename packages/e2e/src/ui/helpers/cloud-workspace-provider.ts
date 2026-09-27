import { type APIRequestContext, expect } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

const sdkExtensionsModule = ["@pstdio", "sdk", "extensions"].join("/");
const source = `import type {
  ExtensionDefinition, WorkspaceTypeProvider, WorkspaceProviderRef, WorkspaceProviderResult,
} from "${sdkExtensionsModule}";

const ready = (extensionId: string, providerRef: WorkspaceProviderRef): WorkspaceProviderResult => ({
  state: "ready",
  executionKind: "remote",
  providerRef,
  executionTarget: { kind: "remote", providerId: extensionId + ".workspace-type.remote", providerRef },
  capabilities: { files: "none", diff: false, merge: false, rebase: false, archive: false, delete: true },
});

const remote = {
  id: "remote",
  ref: { kind: "workspace-type", id: "remote" },
  label: "Test cloud workspace",
  params: {
    source: { type: "text", label: "Source template", required: true },
    provider_id: { type: "text", label: "Environment profile", required: true },
  },
  create(ctx, input) {
    if (!input.params.source || !input.params.provider_id) throw new Error("Choose a template and profile.");
    return ready(ctx.extensionId, {
      version: 1,
      data: { environment: input.workspaceId, params: input.params },
    });
  },
  resolve: (ctx, input) => ready(ctx.extensionId, input.providerRef),
  delete: async () => {},
} satisfies WorkspaceTypeProvider;

export default { workspaceTypes: [remote] } satisfies ExtensionDefinition;
`;

export const enableCloudWorkspaceProvider = async (input: {
  request: APIRequestContext;
  apiBase: string;
  projectId: string;
  workspaceId: string;
  rootPath: string;
}) => {
  const { request, apiBase, projectId, workspaceId, rootPath } = input;
  const installName = `cloud-workspace-${crypto.randomUUID()}`;
  const extensionId = `example.${installName}`;
  const extensionPath = `.pstdio/extensions/${installName}`;
  const workspaceUrl = `${apiBase}/v1/workspaces/${workspaceId}`;
  for (const path of [".pstdio", ".pstdio/extensions", extensionPath]) {
    const response = await request.post(`${workspaceUrl}/directory?path=${encodeURIComponent(path)}`);
    expect([201, 409]).toContain(response.status());
  }
  const manifest = {
    name: installName,
    publisher: "example",
    version: "1.0.0",
    main: "./extension.ts",
    type: "module",
    engines: { pstdio: EXTENSION_API_VERSION },
    pstdio: { scope: "repo" },
  };
  for (const [name, content] of [
    ["extension.ts", source],
    ["package.json", JSON.stringify(manifest)],
  ]) {
    const response = await request.post(`${workspaceUrl}/file?path=${encodeURIComponent(`${extensionPath}/${name}`)}`, {
      data: { content },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
  const enabled = await request.post(`${apiBase}/v1/projects/${projectId}/extensions/installed/${installName}/enable`, {
    data: {
      displayName: "Test cloud workspace",
      extensionId,
      manifest: { id: extensionId, name: installName },
      name: installName,
      sourceHash: installName,
      sourceKind: "local_path",
      sourcePath: `${rootPath}/${extensionPath}`,
      sourceRef: null,
      version: "1.0.0",
    },
  });
  expect(enabled.ok(), await enabled.text()).toBe(true);
  return `${extensionId}.workspace-type.remote`;
};
