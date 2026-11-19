import type { ArtifactMount, CommandContext } from "@pstdio/sdk/extensions";

export const templateDirectory = ".pstdio/extension-storage/pocketcoder.pocketcoder/templates";
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a Template object.");
  return value as Record<string, unknown>;
};
const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Template ${field} is required.`);
  return value;
};

export function parseCatalogTemplate(path: string, source: string) {
  const manifest = object(path.endsWith(".json") ? JSON.parse(source) : Bun.YAML.parse(source));
  if (
    !["pocketcoder.dev/v1alpha1", "pocketcoder.dev/v1"].includes(String(manifest.apiVersion)) ||
    manifest.kind !== "Template"
  )
    throw new Error("Expected a PocketCoder Template.");
  const metadata = object(manifest.metadata);
  const spec = object(manifest.spec);
  return {
    path,
    name: text(metadata.name, "name"),
    version: text(spec.version, "version"),
    description: typeof metadata.description === "string" ? metadata.description : "",
    manifest,
  };
}

export async function listCatalog(files: Pick<ArtifactMount, "list" | "readText">) {
  const paths = (await files.list(`${templateDirectory}/**/*`))
    .map((file) => file.path)
    .filter((path) => /\.(json|ya?ml)$/.test(path))
    .sort();
  return Promise.all(
    paths.map(async (path) => {
      try {
        return { path, template: parseCatalogTemplate(path, await files.readText(path)), error: "" };
      } catch {
        return { path, template: null, error: "Invalid template file. Check its format, name and version." };
      }
    }),
  );
}

export const catalogFiles = (ctx: Pick<CommandContext, "projectFiles">) => {
  if (!ctx.projectFiles) throw new Error("Open this extension in a project with file access.");
  return ctx.projectFiles;
};
export async function selectedTemplate(files: Pick<ArtifactMount, "list" | "readText">, path: string) {
  const selected = (await listCatalog(files)).find((entry) => entry.path === path);
  if (!selected?.template) throw new Error("Choose a listed template with a valid name and version.");
  return selected.template;
}

export async function catalogPathFor(files: Pick<ArtifactMount, "list" | "readText">, name: string, version: string) {
  const entry = (await listCatalog(files)).find(
    ({ template }) => template?.name === name && template.version === version,
  );
  if (!entry) throw new Error(`${name}@${version} is not in this project's template catalog.`);
  return entry.path;
}

export async function templateDocument(files: Pick<ArtifactMount, "list" | "readText">, path: string) {
  const template = await selectedTemplate(files, path);
  return {
    fileName: path.split("/").pop() ?? path,
    filePath: path,
    mimeType: "application/json",
    content: JSON.stringify(template.manifest, null, 2),
    // Published versions are immutable, so a changed manifest needs a new version, not an edit.
    editable: false,
  };
}
