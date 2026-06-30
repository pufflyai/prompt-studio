import { readFileSync } from "node:fs";
import { join } from "node:path";

type CoreExtensionName = "pstdio-planner" | "pstdio-skills";

const coreExtensionPath = (name: CoreExtensionName) => join(import.meta.dirname, "../../../extensions", name);

const readPackageJson = (name: CoreExtensionName) =>
  JSON.parse(readFileSync(join(coreExtensionPath(name), "package.json"), "utf8")) as {
    displayName?: string;
    name: string;
    version?: string;
  };

const enableCoreExtension = async (
  request: {
    post: (url: string, options: { data: unknown }) => Promise<{ ok: () => boolean; text: () => Promise<string> }>;
  },
  apiBase: string,
  projectId: string,
  name: CoreExtensionName,
) => {
  const packageJson = readPackageJson(name);
  const extensionId = `pstdio.${packageJson.name}`;
  const displayName = packageJson.displayName ?? packageJson.name;
  const version = packageJson.version ?? null;

  const response = await request.post(`${apiBase}/v1/projects/${projectId}/extensions/installed/${name}/enable`, {
    data: {
      displayName,
      extensionId,
      manifest: {
        id: extensionId,
        name: packageJson.name,
        displayName,
        version,
      },
      name: packageJson.name,
      sourceHash: `e2e-${name}`,
      sourceKind: "local_path",
      sourcePath: coreExtensionPath(name),
      sourceRef: null,
      version,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to enable ${name}: ${await response.text()}`);
  }
};

export const enableCoreSkillsExtension = (
  request: Parameters<typeof enableCoreExtension>[0],
  apiBase: string,
  projectId: string,
) => enableCoreExtension(request, apiBase, projectId, "pstdio-skills");

export const enableCoreTemplatesExtension = (
  request: Parameters<typeof enableCoreExtension>[0],
  apiBase: string,
  projectId: string,
) => enableCoreExtension(request, apiBase, projectId, "pstdio-planner");
