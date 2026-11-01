import { type CommandContext, defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { readLegacyComparison } from "../legacy";
import { selectionKey } from "../parameters/commands";
import { readCatalog } from "./catalog";
import {
  addShader,
  deleteConfig,
  duplicateConfig,
  listShaders,
  readConfig,
  shadersRoot,
  updateConfig,
} from "./configs";
import { shadersChanged } from "./events";

const findShader = async (ctx: CommandContext, id: string) => {
  const shader = (await readCatalog(projectFiles(ctx))).find((item) => item.id === id);
  if (!shader) throw new Error(`Unknown shader "${id}"`);
  return shader;
};

const projectFiles = (ctx: Pick<CommandContext, "projectFiles">) => {
  if (!ctx.projectFiles) throw new Error("Shader Lab needs a local project folder");
  return ctx.projectFiles;
};
const version = { shader: params.text({ required: true }), version: params.text({ required: true }) };

const list = defineCommand({
  id: "shaders.list",
  cli: true,
  title: l10n("shaders.list", "List shaders and their versions"),
  params: {},
  async run(ctx) {
    return (await listShaders(projectFiles(ctx))).map((shader) => ({
      ...shader,
      versions: shader.versions.map(({ id, name }) => ({ id, name })),
    }));
  },
});

const add = defineCommand({
  id: "shaders.add",
  cli: true,
  mutating: true,
  title: l10n("shaders.add", "Add a shader to the lab"),
  params: {
    shader: params.text({ required: true }),
  },
  async run(ctx, input) {
    const config = await addShader(projectFiles(ctx), await findShader(ctx, input.shader));
    await ctx.events.emit(shadersChanged, {});
    return config;
  },
});

const read = defineCommand({
  id: "version.read",
  cli: true,
  title: l10n("version.read", "Read a shader version"),
  params: version,
  async run(ctx, input) {
    return readConfig(projectFiles(ctx), await findShader(ctx, input.shader), input.version);
  },
});

const update = defineCommand({
  id: "version.update",
  cli: true,
  mutating: true,
  title: l10n("version.update", "Update a shader version"),
  params: { ...version, values: params.json<Record<string, number>, { required: true }>({ required: true }) },
  async run(ctx, input) {
    const config = await updateConfig(projectFiles(ctx), await findShader(ctx, input.shader), input.version, {
      values: input.values,
    });
    await ctx.events.emit(shadersChanged, {});
    return config;
  },
});

const rename = defineCommand({
  id: "version.rename",
  cli: true,
  mutating: true,
  title: l10n("version.rename", "Rename a shader version"),
  params: { ...version, name: params.text({ required: true }) },
  async run(ctx, input) {
    const config = await updateConfig(projectFiles(ctx), await findShader(ctx, input.shader), input.version, {
      name: input.name,
    });
    await ctx.events.emit(shadersChanged, {});
    return config;
  },
});

const duplicate = defineCommand({
  id: "version.duplicate",
  cli: true,
  mutating: true,
  title: l10n("version.duplicate", "Duplicate a shader version"),
  params: { ...version, name: params.text({ required: true }) },
  async run(ctx, input) {
    const config = await duplicateConfig(
      projectFiles(ctx),
      await findShader(ctx, input.shader),
      input.version,
      input.name,
    );
    await ctx.events.emit(shadersChanged, {});
    return config;
  },
});

const remove = defineCommand({
  id: "version.delete",
  cli: true,
  mutating: true,
  title: l10n("version.delete", "Delete a shader version"),
  params: version,
  async run(ctx, input) {
    await deleteConfig(projectFiles(ctx), await findShader(ctx, input.shader), input.version);
    await ctx.events.emit(shadersChanged, {});
    return { deleted: input.version };
  },
});

// The comparison choice is review state, not design data, so it stays in extension storage.
const comparisonKey = (shader: string) => {
  if (!/^[a-z0-9-]+$/.test(shader)) throw new Error("Invalid shader ID");
  return selectionKey({ canvas: `${shadersRoot}/${shader}/shader.canvas.tsx`, frame: "Compare" });
};
const versionExists = async (ctx: CommandContext, shader: string, file: string) =>
  /^[a-z0-9][a-z0-9-]*\.json$/.test(file) && (await projectFiles(ctx).exists(`${shadersRoot}/${shader}/${file}`));
const compareRead = defineCommand({
  id: "compare.read",
  title: l10n("compare.read", "Read the compared version"),
  params: { shader: params.text({ required: true }) },
  async run(ctx, input) {
    const collection = ctx.storage.collection<string>("parameter-versions");
    const key = comparisonKey(input.shader);
    let file = await collection.get(key);
    if (!file && !(await ctx.storage.collection("legacy-imports").get(`shader:${input.shader}`))) {
      const previous = await readLegacyComparison(ctx, input.shader);
      if (typeof previous === "string") {
        file = `${previous}.json`;
        await collection.put(key, file);
        await ctx.storage.collection<boolean>("legacy-imports").put(`shader:${input.shader}`, true);
      }
    }
    if (file && !(await versionExists(ctx, input.shader, file))) {
      await collection.delete(key);
      await ctx.storage.collection<boolean>("legacy-imports").put(`shader:${input.shader}`, true);
      file = undefined;
    }
    return { version: file?.replace(/\.json$/, "") ?? null };
  },
});

const compareUpdate = defineCommand({
  id: "compare.update",
  mutating: true,
  title: l10n("compare.update", "Choose the compared version"),
  params: { shader: params.text({ required: true }), version: params.text() },
  async run(ctx, input) {
    const collection = ctx.storage.collection<string>("parameter-versions");
    const key = comparisonKey(input.shader);
    if (input.version) {
      const file = `${input.version}.json`;
      if (!(await versionExists(ctx, input.shader, file))) throw new Error("That shader version does not exist");
      await collection.put(key, file);
    } else await collection.delete(key);
    await ctx.storage.collection<boolean>("legacy-imports").put(`shader:${input.shader}`, true);
    await ctx.events.emit(shadersChanged, {});
    return { version: input.version ?? null };
  },
});

export const shaderCommands = {
  "shaders.list": list,
  "shaders.add": add,
  "version.read": read,
  "version.update": update,
  "version.rename": rename,
  "version.duplicate": duplicate,
  "version.delete": remove,
  "compare.read": compareRead,
  "compare.update": compareUpdate,
};
