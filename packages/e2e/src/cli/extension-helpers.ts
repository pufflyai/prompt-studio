import { readFileSync } from "node:fs";
import { join } from "node:path";

type CoreExtensionName = "pstdio-core-skills" | "pstdio-core-templates" | "pstdio-core-tickets";

const coreExtensionPath = (name: CoreExtensionName) => join(import.meta.dirname, "../../../../extensions", name);

const readPackageJson = (name: CoreExtensionName) =>
  JSON.parse(readFileSync(join(coreExtensionPath(name), "package.json"), "utf8")) as {
    displayName?: string;
    name: string;
    version?: string;
  };

const enableCoreExtension = async (apiUrl: string, projectId: string, name: CoreExtensionName) => {
  const packageJson = readPackageJson(name);
  const extensionId = `pstdio.${packageJson.name}`;
  const displayName = packageJson.displayName ?? packageJson.name;
  const version = packageJson.version ?? null;

  const response = await fetch(`${apiUrl}/v1/projects/${projectId}/extensions/installed/${name}/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to enable ${name}: ${response.status} ${await response.text()}`);
  }
};

export const enableCoreSkillsExtension = (apiUrl: string, projectId: string) =>
  enableCoreExtension(apiUrl, projectId, "pstdio-core-skills");

export const enableCoreTemplatesExtension = (apiUrl: string, projectId: string) =>
  enableCoreExtension(apiUrl, projectId, "pstdio-core-templates");

export const enableCoreTicketsExtension = (apiUrl: string, projectId: string) =>
  enableCoreExtension(apiUrl, projectId, "pstdio-core-tickets");
