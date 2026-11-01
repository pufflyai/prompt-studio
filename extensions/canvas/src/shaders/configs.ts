import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { defaultValues, normalizeValues, readCatalog, type ShaderDefinition, type ShaderValues } from "./catalog";

// Versions live in the repo so reviewed values travel with the design: one file per version.
// A shader is in the lab while it has at least one version file.
export const shadersRoot = "design/shaders";

export interface ShaderConfig {
  shader: string;
  id: string;
  name: string;
  values: ShaderValues;
}

type ConfigFiles = Pick<ArtifactMount, "exists" | "readText" | "writeText" | "list" | "delete">;

const configPath = (shader: string, id: string) => {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid shader version ID");
  return `${shadersRoot}/${shader}/${id}.json`;
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "version";

export const readConfig = async (files: ConfigFiles, shader: ShaderDefinition, id: string) => {
  const path = configPath(shader.id, id);
  if (!(await files.exists(path))) throw new Error(`Version "${id}" of ${shader.title} does not exist`);
  const data = JSON.parse(await files.readText(path)) as { name?: unknown; values?: unknown };
  return {
    shader: shader.id,
    id,
    name: typeof data.name === "string" && data.name ? data.name : id,
    values: normalizeValues(shader, data.values),
  } satisfies ShaderConfig;
};

export const listConfigs = async (files: ConfigFiles, shader: ShaderDefinition) => {
  const ids = (await files.list(`${shadersRoot}/${shader.id}/*.json`))
    .map(({ path }) => path.slice(`${shadersRoot}/${shader.id}/`.length, -".json".length))
    .filter((id) => /^[a-z0-9-]+$/.test(id));
  const configs = await Promise.all(ids.map((id) => readConfig(files, shader, id)));
  return configs.sort((a, b) => Number(b.id === "default") - Number(a.id === "default") || a.id.localeCompare(b.id));
};

export const listShaders = async (files: ConfigFiles) => {
  const entries = await Promise.all(
    (await readCatalog(files)).map(async (shader) => ({ shader, versions: await listConfigs(files, shader) })),
  );
  return entries
    .filter((entry) => entry.versions.length > 0)
    .map(({ shader, versions }) => ({ id: shader.id, title: shader.title, description: shader.description, versions }));
};

const writeConfig = async (files: ConfigFiles, config: ShaderConfig) => {
  const { name, values } = config;
  await files.writeText(configPath(config.shader, config.id), `${JSON.stringify({ name, values }, null, 2)}\n`);
  return config;
};

const syncCanvas = async (files: ConfigFiles, shader: ShaderDefinition) => {
  const path = `${shadersRoot}/${shader.id}/shader.canvas.tsx`;
  const [first] = await listConfigs(files, shader);
  if (!first) {
    if (await files.exists(path)) await files.delete(path);
    return;
  }
  await files.writeText(
    path,
    `import config from "./${first.id}.json";
import { shaderCanvas } from "../library/canvas-preview";

export default { ...shaderCanvas(${JSON.stringify(shader.id)}, config), title: ${JSON.stringify(`Shaders/${shader.title}`)}, save: { file: "${first.id}.json", key: "values" } };
export const Preview = {};
export const Compare = { defaultTheme: "pstdio-dark" };
`,
  );
};
// Adds a shader back to Canvas with one version at its default values.
export const addShader = async (files: ConfigFiles, shader: ShaderDefinition) => {
  if ((await listConfigs(files, shader)).length) throw new Error("This shader already has saved versions");
  const config = await writeConfig(files, {
    shader: shader.id,
    id: "default",
    name: "Default",
    values: defaultValues(shader),
  });
  await syncCanvas(files, shader);
  return config;
};

export const updateConfig = async (
  files: ConfigFiles,
  shader: ShaderDefinition,
  id: string,
  change: { name?: string; values?: Partial<ShaderValues> },
) => {
  const current = await readConfig(files, shader, id);
  return writeConfig(files, {
    ...current,
    name: change.name?.trim() || current.name,
    values: normalizeValues(shader, { ...current.values, ...change.values }),
  });
};

export const duplicateConfig = async (files: ConfigFiles, shader: ShaderDefinition, sourceId: string, name: string) => {
  const source = await readConfig(files, shader, sourceId);
  const taken = new Set((await listConfigs(files, shader)).map((config) => config.id));
  const base = slug(name);
  let id = base;
  for (let suffix = 2; taken.has(id); suffix += 1) id = `${base}-${suffix}`;
  return writeConfig(files, { ...source, id, name: name.trim() || id });
};

export const deleteConfig = async (files: ConfigFiles, shader: ShaderDefinition, id: string) => {
  const path = configPath(shader.id, id);
  if (await files.exists(path)) await files.delete(path);
  await syncCanvas(files, shader);
};
