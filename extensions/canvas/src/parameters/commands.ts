import { type CommandContext, defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { buildFiles, readBuild } from "../build-mount";
import { parametersChanged } from "../events";
import type { Values } from "./model";

const filename = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-z0-9-]+\.json$/.test(value))
    throw new Error("Use a JSON version file beside the canvas");
  return value;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const target = async (ctx: CommandContext, input: { canvas: string; frame: string }) => {
  if (!ctx.projectFiles) throw new Error("Saving parameters needs a local project folder");
  const build = await readBuild(buildFiles(ctx));
  const canvas =
    build.status === "ready" ? build.manifest.canvases.find((entry) => entry.id === input.canvas) : undefined;
  const frame = canvas?.frames.find((entry) => entry.exportName === input.frame);
  const save = object(object(frame).save);
  const file = filename(save.file);
  const key = typeof save.key === "string" ? save.key : undefined;
  const folder = input.canvas.includes("/") ? input.canvas.slice(0, input.canvas.lastIndexOf("/")) : "";
  const path = (name: string) => `${folder ? `${folder}/` : ""}${filename(name)}`;
  const read = async (name: string) => {
    const data = object(JSON.parse(await ctx.projectFiles!.readText(path(name))));
    const values = object(key ? data[key] : data);
    if (
      !Object.keys(values).length ||
      Object.values(values).some(
        (value) =>
          !["string", "number", "boolean"].includes(typeof value) ||
          (typeof value === "number" && !Number.isFinite(value)),
      )
    )
      throw new Error("This version has no editable values");
    return { data, values: values as Values };
  };
  const original = await read(file);
  const readVersion = async (name: string) => {
    const version = await read(name);
    const expected = Object.keys(original.values);
    if (
      Object.keys(version.values).length !== expected.length ||
      expected.some((key) => typeof original.values[key] !== typeof version.values[key])
    )
      throw new Error("This file is not a version of the frame's parameters");
    return version;
  };
  return { files: ctx.projectFiles, file, key, path, folder, read: readVersion };
};
const frameParams = { canvas: params.text({ required: true }), frame: params.text({ required: true }) };
export const selectionKey = (input: { canvas: string; frame: string }) => `${input.canvas}#${input.frame}`;
const displayName = async (
  ctx: CommandContext,
  source: Awaited<ReturnType<typeof target>>,
  file: string,
  data: Record<string, unknown>,
) => {
  const stored = await ctx.storage.collection<string>("parameter-version-names").get(source.path(file));
  return stored ?? (source.key && typeof data.name === "string" ? data.name : file.replace(/\.json$/, ""));
};
const versions = defineCommand({
  id: "parameters.versions",
  cli: true,
  title: l10n("parameters.versions", "Read saved frame parameters"),
  params: frameParams,
  async run(ctx, input) {
    const source = await target(ctx, input);
    const entries = await source.files.list(`${source.folder ? `${source.folder}/` : ""}*.json`);
    const versions = [];
    for (const entry of entries) {
      const file = entry.path.split("/").at(-1)!;
      try {
        const { data, values } = await source.read(file);
        versions.push({ file, name: await displayName(ctx, source, file, data), values });
      } catch {
        /* Other JSON files beside the canvas are not saved parameter versions. */
      }
    }
    const selected = await ctx.storage.collection<string>("parameter-versions").get(selectionKey(input));
    const restored = versions.some((version) => version.file === selected);
    return { file: restored ? selected! : source.file, restored, versions };
  },
});
const save = defineCommand({
  id: "parameters.save",
  cli: true,
  mutating: true,
  title: l10n("parameters.save", "Save frame parameters"),
  params: {
    ...frameParams,
    file: params.text(),
    name: params.text(),
    values: params.json<Values, { required: true }>({ required: true }),
  },
  async run(ctx, input) {
    const source = await target(ctx, input);
    const current = filename(input.file ?? source.file);
    const { data, values: before } = await source.read(current);
    const values = { ...before };
    for (const [key, value] of Object.entries(input.values)) {
      if (
        !Object.hasOwn(before, key) ||
        typeof value !== typeof before[key] ||
        (typeof value === "number" && !Number.isFinite(value))
      )
        throw new Error(`Invalid saved parameter: ${key}`);
      values[key] = value;
    }
    let file = current;
    if (input.name !== undefined) {
      const slug = input.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (!slug) throw new Error("Enter a version name");
      file = filename(`${slug}.json`);
      if (await source.files.exists(source.path(file))) throw new Error("That version already exists");
      if (source.key) data.name = input.name.trim();
    }
    const saved = source.key ? { ...data, [source.key]: values } : values;
    await source.files.writeText(source.path(file), `${JSON.stringify(saved, null, 2)}\n`);
    if (!source.key && input.name)
      await ctx.storage.collection<string>("parameter-version-names").put(source.path(file), input.name.trim());
    await ctx.storage.collection<string>("parameter-versions").put(selectionKey(input), file);
    await ctx.events.emit(parametersChanged, {});
    return { file, name: await displayName(ctx, source, file, data), values };
  },
});
const select = defineCommand({
  id: "parameters.select",
  mutating: true,
  cli: true,
  title: l10n("parameters.select", "Choose a saved frame version"),
  params: { ...frameParams, file: params.text({ required: true }) },
  async run(ctx, input) {
    const source = await target(ctx, input);
    const { data, values } = await source.read(filename(input.file));
    await ctx.storage.collection<string>("parameter-versions").put(selectionKey(input), input.file);
    await ctx.events.emit(parametersChanged, {});
    return { file: input.file, name: await displayName(ctx, source, input.file, data), values };
  },
});
const rename = defineCommand({
  id: "parameters.rename",
  mutating: true,
  cli: true,
  title: l10n("parameters.rename", "Rename a saved frame version"),
  params: { ...frameParams, file: params.text({ required: true }), name: params.text({ required: true }) },
  async run(ctx, input) {
    const source = await target(ctx, input);
    const { data } = await source.read(filename(input.file));
    if (!input.name.trim()) throw new Error("Enter a version name");
    if (source.key)
      await source.files.writeText(
        source.path(input.file),
        `${JSON.stringify({ ...data, name: input.name.trim() }, null, 2)}\n`,
      );
    else
      await ctx.storage.collection<string>("parameter-version-names").put(source.path(input.file), input.name.trim());
    await ctx.events.emit(parametersChanged, {});
    return { file: input.file, name: input.name.trim() };
  },
});
const remove = defineCommand({
  id: "parameters.delete",
  mutating: true,
  cli: true,
  title: l10n("parameters.delete", "Delete a saved frame version"),
  params: { ...frameParams, file: params.text({ required: true }) },
  async run(ctx, input) {
    const source = await target(ctx, input);
    const file = filename(input.file);
    if (file === source.file) throw new Error("The authored frame still uses this version");
    await source.read(file);
    await source.files.delete(source.path(file));
    await ctx.storage.collection("parameter-version-names").delete(source.path(file));
    const selection = ctx.storage.collection<string>("parameter-versions");
    const selected = await selection.get(selectionKey(input));
    const next = selected === file ? source.file : (selected ?? source.file);
    if (selected === file) await selection.put(selectionKey(input), next);
    await ctx.events.emit(parametersChanged, {});
    return { file: next };
  },
});
export const parameterCommands = {
  "parameters.versions": versions,
  "parameters.save": save,
  "parameters.select": select,
  "parameters.rename": rename,
  "parameters.delete": remove,
};
